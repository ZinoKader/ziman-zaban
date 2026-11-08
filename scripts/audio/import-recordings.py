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
import hashlib
import json
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
        problems: list[str] = []
        work = tmpdir()
        for take in index["takes"]:
            text = take["text"]
            if text not in known[lang]:
                problems.append(f"not in the course: {text}")
                continue
            old = clips.get(text)
            if old and old.get("recordedAt", "") > take["recordedAt"]:
                problems.append(f"newer take already imported: {text}")
                continue
            src = work / Path(take["file"]).name
            src.write_bytes(zf.read(take["file"]))
            key = f"{lang}\n{voice}\n{text}\n{take['recordedAt']}"
            file = f"{lang}/rec-{hashlib.sha1(key.encode()).hexdigest()[:16]}.mp3"
            dest = PUBLIC / file
            seconds = postprocess(src, dest)
            if not MIN_SECONDS <= seconds <= MAX_SECONDS:
                dest.unlink(missing_ok=True)
                problems.append(f"{seconds:.1f} s long, left out: {text}")
                continue
            if old and old["f"] != file:
                (PUBLIC / old["f"]).unlink(missing_ok=True)
            clips[text] = {"f": file, "v": voice, "recordedAt": take["recordedAt"]}
            added += 1
        print(f"{path.name}: {added} of {len(index['takes'])} takes by {name} ({lang}, voice {voice})")
        for p in problems:
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
