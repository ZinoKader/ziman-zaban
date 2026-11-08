"""Imports native speakers' recordings exported from the app's "Record voices" page (/studio).

    npm run audio:import -- ziman-zaban-recordings-ckb-aras-202611081005.zip [more.zip ...]
    npm run audio:import -- --remove-speaker ckb-rec-aras

Each take is trimmed, loudness-normalized and encoded like the generated clips (mono 24 kHz MP3,
-16 LUFS), written to public/audio/<lang>/rec-<hash>.mp3 and listed in recordings.json (committed).
The manifest then points those texts at the recording instead of the generated clip. The generated
clip stays on disk, so removing a recording brings it back. A newer take of a text replaces an older one.
"""

from __future__ import annotations

import argparse
import array
import hashlib
import json
import math
import wave
import zipfile
from pathlib import Path

from common import (
    LANGS,
    PUBLIC,
    load_recordings,
    load_texts,
    load_verification,
    postprocess,
    save_recordings,
    speaker_id,
    tmpdir,
    write_manifest,
)

FORMAT = "ziman-zaban-recordings"
MIN_SECONDS = 0.25
MAX_SECONDS = 20.0

FRAME_S = 0.01
# Frames within this range of the loudest frame are speech; quieter ones are left to the edge trim.
STRONG_DB = 25
# Sounds closer together than this belong to the same utterance (a pause inside a phrase).
JOIN_GAP_S = 0.3
# A separate sound this long and this loud (relative to the speech) is kept as a second word.
KEEP_S = 0.25
KEEP_WITHIN_DB = 10
# The cut sits this far from a dropped sound, so soft word edges next to it stay.
MARGIN_S = 0.05
PEAK = 32768 * 10 ** (-6 / 20)
MAX_GAIN = 10 ** (40 / 20)


def clean_take(src: Path, dest: Path) -> bool:
    """
    Cuts a take down to its speech, dropping clicks, breaths and rustle that a pause separates from it,
    and raises it to a fixed peak so the edge trim in postprocess works the same for quiet and loud
    microphones. Writes `dest` and returns True when a stray sound was dropped.
    """
    with wave.open(str(src)) as w:
        if w.getsampwidth() != 2 or w.getnchannels() != 1:
            raise SystemExit(f"{src.name}: expected 16-bit mono WAV")
        rate = w.getframerate()
        samples = array.array("h", w.readframes(w.getnframes()))
    first, last, dropped = speech_span(samples, rate)
    samples = samples[first:last]
    top = max((abs(s) for s in samples), default=0)
    if top:
        gain = min(PEAK / top, MAX_GAIN)
        samples = array.array("h", (max(-32768, min(32767, round(s * gain))) for s in samples))
    with wave.open(str(dest), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(samples.tobytes())
    return dropped


def speech_span(samples: array.array, rate: int) -> tuple[int, int, bool]:
    """The sample range to keep, and whether a stray sound was left out of it."""
    hop = int(rate * FRAME_S)
    db = []
    for i in range(0, len(samples) - hop + 1, hop):
        frame = samples[i : i + hop]
        db.append(10 * math.log10(sum(s * s for s in frame) / hop / 32768**2 + 1e-12))
    n = len(db)
    if n < 10:
        return 0, len(samples), False
    floor = sorted(db)[n // 10]
    peak = max(db)
    strong = [d > max(floor + 12, peak - STRONG_DB) for d in db]

    clusters: list[list[int]] = []  # [first frame, last frame + 1]
    for i, v in enumerate(strong):
        if not v:
            continue
        if clusters and (i - clusters[-1][1]) * FRAME_S < JOIN_GAP_S:
            clusters[-1][1] = i + 1
        else:
            clusters.append([i, i + 1])

    def weight(c: list[int]) -> float:
        return sum(db[i] - floor for i in range(c[0], c[1]) if strong[i])

    main = max(clusters, key=weight)
    main_peak = max(db[main[0] : main[1]])
    kept = [
        c
        for c in clusters
        if c is main or ((c[1] - c[0]) * FRAME_S >= KEEP_S and max(db[c[0] : c[1]]) >= main_peak - KEEP_WITHIN_DB)
    ]
    if len(kept) == len(clusters):
        return 0, len(samples), False
    margin = round(MARGIN_S / FRAME_S)
    start, end = min(c[0] for c in kept), max(c[1] for c in kept)
    before = max((c[1] for c in clusters if c[1] <= start), default=None)
    after = min((c[0] for c in clusters if c[0] >= end), default=None)
    first = (before + margin) * hop if before is not None else 0
    last = (after - margin) * hop if after is not None else len(samples)
    return first, last, True


def import_zip(path: Path, recordings: dict, known: dict[str, set[str]]) -> None:
    with zipfile.ZipFile(path) as zf:
        index = json.loads(zf.read("takes.json"))
        if index.get("format") != FORMAT or index.get("version") != 1:
            raise SystemExit(f"{path.name}: not a recordings file from the app")
        lang = index["lang"]
        if lang not in LANGS:
            raise SystemExit(f"{path.name}: unknown language {lang!r}")
        name = index["speaker"].strip() or "Unknown speaker"
        voice = speaker_id(lang, name)
        recordings["speakers"][voice] = {
            "name": name,
            "lang": lang,
            "license": index["license"],
            "consentAt": index["consentAt"],
        }
        clips = recordings["clips"][lang]
        added = 0
        notes: list[str] = []
        work = tmpdir()
        for take in index["takes"]:
            text = take["text"]
            if text not in known[lang]:
                notes.append(f"not in the course: {text}")
                continue
            old = clips.get(text)
            if old and old.get("recordedAt", "") > take["recordedAt"]:
                notes.append(f"newer take already imported: {text}")
                continue
            src = work / Path(take["file"]).name
            src.write_bytes(zf.read(take["file"]))
            clean = work / f"clean-{src.name}"
            if clean_take(src, clean):
                notes.append(f"stray sound cut: {text}")
            src = clean
            key = f"{lang}\n{voice}\n{text}\n{take['recordedAt']}"
            file = f"{lang}/rec-{hashlib.sha1(key.encode()).hexdigest()[:16]}.mp3"
            dest = PUBLIC / file
            seconds = postprocess(src, dest)
            if not MIN_SECONDS <= seconds <= MAX_SECONDS:
                dest.unlink(missing_ok=True)
                notes.append(f"{seconds:.1f} s long, left out: {text}")
                continue
            if old and old["f"] != file:
                (PUBLIC / old["f"]).unlink(missing_ok=True)
            clips[text] = {"f": file, "v": voice, "recordedAt": take["recordedAt"]}
            added += 1
        print(f"{path.name}: {added} of {len(index['takes'])} takes by {name} ({lang}, voice {voice})")
        for p in notes:
            print(f"  {p}")


def remove_speaker(voice: str, recordings: dict) -> None:
    removed = 0
    for lang in LANGS:
        clips = recordings["clips"][lang]
        for text in [t for t, c in clips.items() if c["v"] == voice]:
            (PUBLIC / clips[text]["f"]).unlink(missing_ok=True)
            del clips[text]
            removed += 1
    recordings["speakers"].pop(voice, None)
    print(f"removed {removed} recordings by {voice}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("zips", nargs="*", type=Path, help="files downloaded from the Record voices page")
    ap.add_argument("--remove-speaker", metavar="VOICE", help="delete every recording by this voice id")
    args = ap.parse_args()
    if not args.zips and not args.remove_speaker:
        ap.error("give at least one zip file, or --remove-speaker")

    texts = load_texts()
    known = {lang: {e["text"] for e in texts.get(lang, [])} for lang in LANGS}
    recordings = load_recordings()
    if args.remove_speaker:
        remove_speaker(args.remove_speaker, recordings)
    for z in args.zips:
        import_zip(z, recordings, known)
    save_recordings(recordings)
    manifest = write_manifest(texts, load_verification())
    for lang in LANGS:
        human = sum(1 for c in manifest[lang].values() if c.get("h"))
        print(f"manifest {lang}: {human} of {len(texts[lang])} texts use a native recording")


if __name__ == "__main__":
    main()
