"""Audio8 TTS engines: Sorani (ArminRahimi/Audio8-TTS-Kurdish-Sorani) and Persian (ArminRahimi/Audio8-TTS-Persian),
each with its default voice.

A 0.6B DualAR model (slow + fast autoregressive transformer over neural-codec tokens). The Persian model is
fine-tuned on Mana-TTS and GPTInformal-Persian, the Sorani one from it on central-kurdish-tts4all. Weights
CC BY-NC 4.0, model code Apache-2.0 (Audio8 TTS by Edge0-AI). Runs on CPU: about 3 s per clip on 8 cores.

Generation samples tokens. Now and then a single word comes out with a babbled syllable appended, which
makes the clip about twice as long as its text needs; `synth_batch` re-samples such clips. A clip that
still fails verification is re-rendered as another "take" (a different seed) before falling back to Berfin.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

import numpy as np

from ckb_normalize import normalize_ckb
from fa_normalize import normalize_fa

MODELS_BY_LANG = {
    "ckb": ("ArminRahimi/Audio8-TTS-Kurdish-Sorani", "27e79b2ba33795b22aed1daf4bc13b1e4c0df5c", normalize_ckb),
    "fa": ("ArminRahimi/Audio8-TTS-Persian", "bcca4112db62fccaf733772226d4f9931a088a0a", normalize_fa),
}
# Seconds per letter. Sorani: good clips last 0.7-1.07x of 0.3 s + 0.07 s per letter + 0.2 s per inner pause;
# the babbled ones were about 2x. Persian script leaves short vowels unwritten, so each letter takes longer.
SEC_PER_CHAR = {"ckb": 0.07, "fa": 0.095}
SEC_PER_PAUSE, MIN_FACTOR, MAX_FACTOR = 0.2, 0.5, 1.5
MIN_CAP_SECONDS = 4.0
RESAMPLES = 2
FRAMES_PER_SECOND = 44100 / 2048  # codec frames (one generation step each)


def expected_seconds(text: str, lang: str = "ckb") -> float:
    body = text.strip().rstrip(".!?؟")
    pauses = sum(body.count(p) for p in "،,.!?؟:؛")
    return 0.3 + SEC_PER_CHAR[lang] * len(text.replace(" ", "").replace("\u200c", "")) + SEC_PER_PAUSE * pauses


def plausible(text: str, seconds: float, lang: str = "ckb") -> bool:
    return MIN_FACTOR <= seconds / expected_seconds(text, lang) <= MAX_FACTOR


def ensure_model(models: Path, lang: str = "ckb") -> Path:
    from huggingface_hub import snapshot_download

    repo, revision, _ = MODELS_BY_LANG[lang]
    return Path(snapshot_download(repo, revision=revision, local_dir=models / f"audio8-{lang}"))


class Audio8Engine:
    def __init__(self, models: Path, lang: str = "ckb", threads: int | None = None) -> None:
        import torch
        from transformers import AutoModel, AutoProcessor

        torch.set_num_threads(threads or os.cpu_count() or 4)
        self.lang = lang
        self.normalize = MODELS_BY_LANG[lang][2]
        path = ensure_model(models, lang)
        self.processor = AutoProcessor.from_pretrained(path, trust_remote_code=True)
        self.model = AutoModel.from_pretrained(path, trust_remote_code=True, dtype=torch.float32).eval()
        self.sample_rate = self.model.config.codec_sample_rate
        self.clips = self.resampled = self.implausible = 0

    def _generate(self, texts: list[str], seed: int) -> list[np.ndarray]:
        import torch

        inputs = self.processor(text=[self.normalize(t) for t in texts], return_tensors="pt")
        gen = torch.Generator().manual_seed(seed)
        # A batch runs until every clip has ended, so one reading that never stops would otherwise cost the
        # whole batch 1024 steps. Anything longer than the plausible maximum is discarded anyway.
        # Very short words need some room for the model's lead-in and ending, whatever the estimate says.
        frames = FRAMES_PER_SECOND * max(MIN_CAP_SECONDS, MAX_FACTOR * max(expected_seconds(t, self.lang) for t in texts))
        with torch.inference_mode():
            out = self.model.generate(
                **inputs, max_new_tokens=min(1024, int(frames) + 8), temperature=0.8, top_p=0.95, top_k=50,
                do_sample=True, return_dict_in_generate=True, generator=gen,
            )
            audio, lengths = self.model.decode_audio(out.codes)
        empty = np.zeros(0, np.float32)
        return [audio[i, : int(lengths[i])].numpy() if out.finished[i] else empty for i in range(len(texts))]

    def synth_batch(self, texts: list[str], take: int = 0) -> list[np.ndarray]:
        """One padded batch; texts of similar length waste the least compute. Seeds follow the batch's texts
        and `take`, so a rerun of the same batch gives the same audio."""
        result: list[np.ndarray | None] = [None] * len(texts)
        todo = list(range(len(texts)))
        for attempt in range(RESAMPLES + 1):
            key = f"{take}:{attempt}:" + "\n".join(texts[i] for i in todo)
            seed = int(hashlib.sha1(key.encode()).hexdigest()[:8], 16)
            retry = []
            for i, wav in zip(todo, self._generate([texts[i] for i in todo], seed)):
                last = attempt == RESAMPLES
                if plausible(texts[i], len(wav) / self.sample_rate, self.lang) or (last and len(wav)):
                    result[i] = wav
                else:
                    retry.append(i)
            todo = retry
            if not todo:
                break
            if attempt < RESAMPLES:
                self.resampled += len(todo)
        self.clips += len(texts)
        self.implausible += sum(
            not plausible(t, len(w) / self.sample_rate, self.lang) for t, w in zip(texts, result) if w is not None
        )
        return [w if w is not None else np.zeros(0, np.float32) for w in result]
