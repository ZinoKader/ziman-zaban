"""ParsVoice-XTTS (MohammadJRanjbar/ParsVoice-XTTS): Coqui XTTS-v2 fine-tuned on the ParsVoice corpus
(2,200 h, 1,800+ speakers), with zero-shot voice cloning from a short reference clip. CPML, non-commercial.

The model needs the Persian-capable XTTS fork and older transformers/numpy than Audio8, so it runs in its
own virtual environment (`requirements-parsvoice.txt`). `Renderer` starts this file as a worker:

    $PARSVOICE_PYTHON scripts/audio/parsvoice.py JOBS.json

and reads one JSON line per finished clip from its stdout.

The model does not stop on short inputs: anything under about three seconds comes out as babble. So
every text is read after a fixed carrier sentence, and the clip is cut at the pause between the two.
Single words still fail that way and stay with Audio8.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

REPO = "MohammadJRanjbar/ParsVoice-XTTS"
REVISION = "05784cc45b83c2d1cd70bd51e779454e2787af6e"
FORK = "https://github.com/nguyenhoanganh2002/XTTSv2-Finetuning-for-New-Languages"
FORK_COMMIT = "8e59ec37e8c9cf9343503ca7430f5b23729f6389"
SAMPLE_RATE = 24000

# "Now repeat this word carefully." / "Please listen to this sentence." The second is tried when the
# first leaves no clean pause to cut at, or the reading runs on.
CARRIERS = ("حالا این کلمه را با دقت تکرار کنید.", "لطفاً این جمله را گوش کنید.")
# Where the carrier ends: the pause has to end between these many seconds into the audio.
CARRIER_END = {CARRIERS[0]: (1.4, 3.4), CARRIERS[1]: (1.0, 3.0)}
# The settings from the model's inference notebook: close to greedy, so a text always reads the same.
INFERENCE = {"temperature": 0.1, "length_penalty": 1.0, "repetition_penalty": 10.0, "top_k": 10, "top_p": 0.3}
# The tokenizer was trained on ASCII punctuation.
PUNCT = str.maketrans({"؟": "?", "،": ",", "؛": ";", "«": '"', "»": '"', "…": "."})


def ensure_model(models: Path) -> Path:
    """Downloads the weights (gated: needs HF_TOKEN from an account that accepted the model's terms) and the fork."""
    from huggingface_hub import snapshot_download

    target = models / "parsvoice"
    snapshot_download(REPO, revision=REVISION, local_dir=target, allow_patterns=["*.json", "*.pth"])
    fork = target / "xtts-fork"
    if not (fork / "TTS").exists():
        subprocess.run(["git", "clone", "--quiet", FORK, str(fork)], check=True)
        subprocess.run(["git", "-C", str(fork), "checkout", "--quiet", FORK_COMMIT], check=True)
    return target


def prep(text: str) -> str:
    t = text.translate(PUNCT).strip()
    return t if t[-1:] in (".", "?", "!") else t + "."


def silent_gaps(audio, thresh_db: float = -40, min_s: float = 0.12) -> list[tuple[float, float]]:
    import numpy as np

    hop = SAMPLE_RATE // 100
    frames = audio[: len(audio) // hop * hop].reshape(-1, hop)
    quiet = 20 * np.log10(np.sqrt((frames**2).mean(1)) + 1e-9) < thresh_db
    out, start = [], None
    for i, q in enumerate([*quiet, False]):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if (i - start) / 100 >= min_s:
                out.append((start / 100, i / 100))
            start = None
    return out


def cut_after_carrier(audio, carrier: str):
    lo, hi = CARRIER_END[carrier]
    gaps = [g for g in silent_gaps(audio) if lo <= g[1] <= hi]
    if not gaps:
        return None
    start, end = max(gaps, key=lambda g: g[1] - g[0])
    return audio[int(max(start, end - 0.05) * SAMPLE_RATE) :]


def worker(jobs_path: str) -> None:
    import numpy as np
    import torch

    jobs = json.loads(Path(jobs_path).read_text())
    torch.set_num_threads(jobs.get("threads") or os.cpu_count() or 4)
    model_dir = Path(jobs["model"])
    sys.path.insert(0, str(model_dir / "xtts-fork"))
    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts

    config = XttsConfig()
    config.load_json(str(model_dir / "config.json"))
    model = Xtts.init_from_config(config)
    model.load_checkpoint(
        config, checkpoint_path=str(model_dir / "model.pth"), vocab_path=str(model_dir / "vocab.json"), use_deepspeed=False
    )
    model.eval()
    speakers: dict[str, tuple] = {}

    for item in jobs["items"]:
        ref = item["ref"]
        if ref not in speakers:
            speakers[ref] = model.get_conditioning_latents(
                audio_path=ref, gpt_cond_len=30, max_ref_length=30, sound_norm_refs=False
            )
        latent, embedding = speakers[ref]
        best = None
        for carrier in CARRIERS:
            torch.manual_seed(int(hashlib.sha1(item["text"].encode()).hexdigest()[:8], 16))
            with torch.inference_mode():
                wav = model.inference(
                    text=f"{carrier} {prep(item['text'])}", language="fa", gpt_cond_latent=latent,
                    speaker_embedding=embedding, **INFERENCE,
                )["wav"]
            clip = cut_after_carrier(np.asarray(wav, dtype=np.float32), carrier)
            if clip is None:
                continue
            if best is None or len(clip) < len(best):
                best = clip
            if len(clip) / SAMPLE_RATE <= item["max_seconds"]:
                break
        if best is not None:
            pcm = (np.clip(best, -1, 1) * 32767).astype(np.int16)
            with wave.open(item["out"], "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(SAMPLE_RATE)
                w.writeframes(pcm.tobytes())
        print(json.dumps({"out": item["out"], "ok": best is not None}), flush=True)


if __name__ == "__main__":
    worker(sys.argv[1])
