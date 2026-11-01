"""Compares Sorani TTS engines on a fixed sample with an ASR round trip.

    python3 scripts/audio/compare.py [--n 40] [--asr hf-whisper:roshna-omer/whisper-small-Kurdish-Sorani ...]

Writes scripts/audio/.compare/<engine>/*.mp3 and prints CER per engine and recogniser.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import wave
from pathlib import Path

import numpy as np

from asr import RECOGNIZERS, Recognizer
from common import HERE, PiperEngine, cer, load_texts, postprocess

OUT = HERE / ".compare"


def sample(n: int) -> list[dict]:
    items = load_texts()["ckb"]
    key = lambda e: hashlib.sha1(e["text"].encode()).hexdigest()  # noqa: E731
    words = sorted((e for e in items if e["kind"] == "word"), key=key)[: n // 2]
    rest = sorted((e for e in items if e["kind"] != "word"), key=key)[: n - n // 2]
    return words + rest


def render_vekol(items: list[dict], speaker: int) -> Path:
    d = OUT / f"vekol-s{speaker}"
    d.mkdir(parents=True, exist_ok=True)
    engine = PiperEngine()
    for i, e in enumerate(items):
        wav = d / f"{i:03d}.wav"
        engine.synth(e["text"], speaker, -10 if e["kind"] == "word" else 0, wav)
        postprocess(wav, d / f"{i:03d}.mp3")
        wav.unlink()
    return d


def render_mms(items: list[dict]) -> Path:
    import torch
    from transformers import AutoTokenizer, VitsModel

    d = OUT / "mms"
    d.mkdir(parents=True, exist_ok=True)
    model = VitsModel.from_pretrained("razhan/mms-tts-ckb").eval()
    tok = AutoTokenizer.from_pretrained("razhan/mms-tts-ckb")
    for i, e in enumerate(items):
        inputs = tok(e["text"], return_tensors="pt")
        with torch.inference_mode():
            audio = model(**inputs).waveform[0].numpy()
        wav = d / f"{i:03d}.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(model.config.sampling_rate)
            w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
        postprocess(wav, d / f"{i:03d}.mp3")
        wav.unlink()
    del model
    return d


def render_audio8(items: list[dict]) -> Path:
    from audio8 import Audio8Engine
    from common import MODELS, write_wav

    d = OUT / "audio8"
    d.mkdir(parents=True, exist_ok=True)
    engine = Audio8Engine(MODELS)
    for i, e in enumerate(items):
        wav = d / f"{i:03d}.wav"
        write_wav(wav, engine.synth_batch([e["text"]])[0], engine.sample_rate)
        postprocess(wav, d / f"{i:03d}.mp3")
        wav.unlink()
    return d


ENGINE_LABELS = {
    "audio8": "Audio8-TTS-Kurdish-Sorani, default voice",
    "vekol-s0": "Vekol-TTS (Piper), speaker Berfin",
    "vekol-s1": "Vekol-TTS (Piper), second speaker",
    "mms": "razhan/mms-tts-ckb (MMS VITS)",
}


def summarize(n: int) -> None:
    """Merges this run into engine-comparison.json; engines measured elsewhere keep their rows."""
    path = HERE / "engine-comparison.json"
    results = json.loads((OUT / "results.json").read_text())
    summary: dict = json.loads(path.read_text()) if path.exists() else {"engines": {}, "results": {}}
    summary.update(n=n, words=n // 2)
    summary["asr"] = list(dict.fromkeys([*summary.get("asr", []), *results]))
    for spec, engines in results.items():
        for engine, rows in engines.items():
            words = [r["cer"] for r in rows if r["kind"] == "word"]
            sents = [r["cer"] for r in rows if r["kind"] != "word"]
            summary["engines"][engine] = ENGINE_LABELS[engine]
            summary["results"].setdefault(spec, {})[engine] = {
                "n": len(rows),
                "mean": round(statistics.mean(r["cer"] for r in rows), 3),
                "words": round(statistics.mean(words), 3),
                "sentences": round(statistics.mean(sents), 3),
            }
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=1) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=40)
    ap.add_argument("--asr", nargs="*", default=RECOGNIZERS["ckb"])
    ap.add_argument("--engines", nargs="*", default=list(ENGINE_LABELS))
    ap.add_argument("--skip-render", action="store_true")
    ap.add_argument("--summarize", action="store_true", help="only rewrite engine-comparison.json from saved results")
    args = ap.parse_args()

    if args.summarize:
        summarize(args.n)
        return
    items = sample(args.n)
    OUT.mkdir(parents=True, exist_ok=True)
    if not args.skip_render:
        for engine in args.engines:
            if engine.startswith("vekol-s"):
                render_vekol(items, int(engine[-1]))
            elif engine == "mms":
                render_mms(items)
            elif engine == "audio8":
                render_audio8(items)

    results = json.loads((OUT / "results.json").read_text()) if (OUT / "results.json").exists() else {}
    for spec in args.asr:
        rec = Recognizer(spec, "ckb")
        for engine in args.engines:
            rows = []
            for i, e in enumerate(items):
                hyp = rec.transcribe(OUT / engine / f"{i:03d}.mp3")
                rows.append({"text": e["text"], "kind": e["kind"], "hyp": hyp, "cer": cer(e["text"], hyp, "ckb")})
            results.setdefault(spec, {})[engine] = rows
            words = [r["cer"] for r in rows if r["kind"] == "word"]
            sents = [r["cer"] for r in rows if r["kind"] != "word"]
            print(
                f"{spec:70s} {engine:9s} mean {statistics.mean(r['cer'] for r in rows):.3f}"
                f"  words {statistics.mean(words):.3f}  sentences {statistics.mean(sents):.3f}"
                f"  median {statistics.median(r['cer'] for r in rows):.3f}",
                flush=True,
            )
        rec.close()
    (OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=1))
    summarize(args.n)


if __name__ == "__main__":
    main()
