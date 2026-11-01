"""Speech recognisers used to check synthesized clips. Load one at a time; call `close()` to free memory."""

from __future__ import annotations

import gc
import json
import os
from pathlib import Path

import numpy as np

from common import MODELS

# Comma-separated overrides: AUDIO_ASR_FA / AUDIO_ASR_CKB, e.g. "fw:small" or "hf-ctc:<repo>,hf-whisper:<repo>".
# "ct2-fa:<repo>" is a Hugging Face Whisper fine-tune converted to CTranslate2 and decoded with the Persian
# language token, which is how the Sorani fine-tune rzgar/whisper-large-v3-sorani-kurdish-ckb-v2 was trained.
RECOGNIZERS = {
    "fa": os.environ.get("AUDIO_ASR_FA", "fw:medium").split(","),
    "ckb": os.environ.get("AUDIO_ASR_CKB", "ct2-fa:rzgar/whisper-large-v3-sorani-kurdish-ckb-v2").split(","),
}

# Whisper large-v3 feature extractor (128 mel bins). The rzgar repo does not ship this file.
WHISPER_V3_FEATURES = {
    "chunk_length": 30,
    "feature_extractor_type": "WhisperFeatureExtractor",
    "feature_size": 128,
    "hop_length": 160,
    "n_fft": 400,
    "n_samples": 480000,
    "nb_max_frames": 3000,
    "padding_side": "right",
    "padding_value": 0.0,
    "processor_class": "WhisperProcessor",
    "return_attention_mask": False,
    "sampling_rate": 16000,
}


def ensure_ct2(repo: str) -> Path:
    """Converts a transformers Whisper checkpoint to CTranslate2 once (about 3 GB for large-v3)."""
    target = MODELS / "ct2" / repo.replace("/", "--")
    if not (target / "model.bin").exists():
        import tempfile

        from ctranslate2.converters import TransformersConverter
        from huggingface_hub import snapshot_download

        print(f"converting {repo} to CTranslate2 (float16) in {target}", flush=True)
        src = Path(snapshot_download(repo, allow_patterns=["*.json", "*.safetensors", "*.txt"]))
        with tempfile.TemporaryDirectory() as tmp:
            local = Path(tmp)
            for f in src.iterdir():
                (local / f.name).symlink_to(f.resolve())
            # Tokenizers saved by transformers 5 list extra special tokens, which 4.x (needed by Audio8) rejects.
            cfg_path = local / "tokenizer_config.json"
            cfg = json.loads(cfg_path.read_text())
            if isinstance(cfg.get("extra_special_tokens"), list):
                del cfg["extra_special_tokens"]
                cfg_path.unlink()
                cfg_path.write_text(json.dumps(cfg))
            # float16 storage, float32 compute: int8 weights break this fine-tune (English tokens leak into the output).
            converter = TransformersConverter(str(local), copy_files=["tokenizer.json"])
            converter.convert(str(target), quantization="float16", force=True)
    features = target / "preprocessor_config.json"
    if not features.exists():
        features.write_text(json.dumps(WHISPER_V3_FEATURES, indent=2) + "\n")
    return target


def load_audio(path: Path, sr: int = 16000) -> np.ndarray:
    import subprocess

    raw = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
        capture_output=True,
        check=True,
    ).stdout
    audio = np.frombuffer(raw, dtype=np.float32)
    # Recognisers trained on natural speech do better with some room around very short clips.
    pad = np.zeros(int(sr * 0.3), dtype=np.float32)
    return np.concatenate([pad, audio, pad])


class Recognizer:
    def __init__(self, spec: str, lang: str) -> None:
        self.spec, self.lang = spec, lang
        kind, _, name = spec.partition(":")
        self.kind = kind
        threads = os.cpu_count() or 4
        if kind == "fw":
            from faster_whisper import WhisperModel

            self.model = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=threads)
        elif kind == "ct2-fa":
            from faster_whisper import WhisperModel

            self.model = WhisperModel(str(ensure_ct2(name)), device="cpu", compute_type="float32", cpu_threads=threads)
        elif kind == "hf-whisper":
            import torch
            from transformers import WhisperForConditionalGeneration, WhisperProcessor

            torch.set_num_threads(threads)
            self.processor = WhisperProcessor.from_pretrained(name)
            self.model = WhisperForConditionalGeneration.from_pretrained(name, torch_dtype=torch.float32).eval()
        elif kind == "hf-ctc":
            import torch
            from transformers import AutoProcessor, Wav2Vec2ForCTC

            torch.set_num_threads(threads)
            self.processor = AutoProcessor.from_pretrained(name)
            self.model = Wav2Vec2ForCTC.from_pretrained(name).eval()
        else:
            raise ValueError(f"unknown recogniser {spec}")

    def transcribe(self, path: Path) -> str:
        audio = load_audio(path)
        if self.kind in ("fw", "ct2-fa"):
            lang = "fa" if self.lang == "fa" or self.kind == "ct2-fa" else None
            # Timestamp decoding makes Whisper loop and hallucinate on clips this short.
            segments, _ = self.model.transcribe(
                audio, language=lang, beam_size=5, vad_filter=False, condition_on_previous_text=False, without_timestamps=True
            )
            return " ".join(s.text.strip() for s in segments).strip()
        import torch

        if self.kind == "hf-whisper":
            feats = self.processor(audio, sampling_rate=16000, return_tensors="pt").input_features
            with torch.inference_mode():
                ids = self.model.generate(feats, max_new_tokens=128, num_beams=3)
            return self.processor.batch_decode(ids, skip_special_tokens=True)[0].strip()
        inputs = self.processor(audio, sampling_rate=16000, return_tensors="pt")
        with torch.inference_mode():
            logits = self.model(**inputs).logits
        return self.processor.batch_decode(torch.argmax(logits, dim=-1))[0].strip()

    def close(self) -> None:
        for attr in ("model", "processor"):
            if hasattr(self, attr):
                delattr(self, attr)
        gc.collect()
