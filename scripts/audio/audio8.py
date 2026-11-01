"""Audio8 Sorani TTS engine (ArminRahimi/Audio8-TTS-Kurdish-Sorani, default voice).

A 0.6B DualAR model (slow + fast autoregressive transformer over neural-codec tokens), fine-tuned from
Audio8-TTS-Persian on the central-kurdish-tts4all corpus. Weights CC BY-NC 4.0, model code Apache-2.0
(Audio8 TTS by Edge0-AI). Runs on CPU: about 3 s per clip on 8 cores.

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

REPO = "ArminRahimi/Audio8-TTS-Kurdish-Sorani"
REVISION = "27e79b2ba33795b22aed1daf4bc13b1e4c0df5c"
# Default voice on varied course texts: good clips last 0.7-1.07x of 0.3 s + 0.07 s per letter + 0.2 s per
# inner pause; the babbled ones were about 2x.
SEC_PER_CHAR, SEC_PER_PAUSE, MIN_FACTOR, MAX_FACTOR = 0.07, 0.2, 0.5, 1.5
RESAMPLES = 2
FRAMES_PER_SECOND = 44100 / 2048  # codec frames (one generation step each)


def expected_seconds(text: str) -> float:
    body = text.strip().rstrip(".!?؟")
    pauses = sum(body.count(p) for p in "،,.!?؟:؛")
    return 0.3 + SEC_PER_CHAR * len(text.replace(" ", "")) + SEC_PER_PAUSE * pauses


def plausible(text: str, seconds: float) -> bool:
    return MIN_FACTOR <= seconds / expected_seconds(text) <= MAX_FACTOR


def ensure_model(models: Path) -> Path:
    from huggingface_hub import snapshot_download

    target = models / "audio8-ckb"
    return Path(snapshot_download(REPO, revision=REVISION, local_dir=target))


class Audio8Engine:
    def __init__(self, models: Path, threads: int | None = None) -> None:
        import torch
        from transformers import AutoModel, AutoProcessor

        torch.set_num_threads(threads or os.cpu_count() or 4)
        path = ensure_model(models)
        self.processor = AutoProcessor.from_pretrained(path, trust_remote_code=True)
        self.model = AutoModel.from_pretrained(path, trust_remote_code=True, dtype=torch.float32).eval()
        self.sample_rate = self.model.config.codec_sample_rate
        self.clips = self.resampled = self.implausible = 0

    def _generate(self, texts: list[str], seed: int) -> list[np.ndarray]:
        import torch

        inputs = self.processor(text=[normalize_ckb(t) for t in texts], return_tensors="pt")
        gen = torch.Generator().manual_seed(seed)
        # A batch runs until every clip has ended, so one reading that never stops would otherwise cost the
        # whole batch 1024 steps. Anything longer than the plausible maximum is discarded anyway.
        frames = FRAMES_PER_SECOND * MAX_FACTOR * max(expected_seconds(t) for t in texts)
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
                if plausible(texts[i], len(wav) / self.sample_rate) or (last and len(wav)):
                    result[i] = wav
                else:
                    retry.append(i)
            todo = retry
            if not todo:
                break
            if attempt < RESAMPLES:
                self.resampled += len(todo)
        self.clips += len(texts)
        self.implausible += sum(not plausible(t, len(w) / self.sample_rate) for t, w in zip(texts, result) if w is not None)
        return [w if w is not None else np.zeros(0, np.float32) for w in result]
