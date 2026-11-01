"""Synthesizes every collected text to public/audio and writes public/audio/manifest.json.

    python3 scripts/audio/generate.py [--lang ckb|fa] [--limit N] [--no-prune]

Incremental: a clip's file name hashes language, voice, rate and text, so existing files are reused.
Persian uses the Azure Speech API when AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are set, otherwise
the Edge read-aloud service (same neural voices).
"""

from __future__ import annotations

import argparse
import sys
import threading
import time

from common import (
    LANGS,
    PUBLIC,
    Renderer,
    azure_configured,
    load_texts,
    load_verification,
    planned_render,
    prune,
    save_verification,
    write_manifest,
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=LANGS)
    ap.add_argument("--limit", type=int, help="render at most N new clips per language (for trying things out)")
    ap.add_argument("--no-prune", action="store_true", help="keep clips that are no longer referenced")
    args = ap.parse_args()

    texts = load_texts()
    verification = load_verification()
    langs = [args.lang] if args.lang else list(LANGS)
    if "fa" in langs:
        print("Persian engine:", "Azure Speech API" if azure_configured() else "Edge read-aloud (set AZURE_SPEECH_KEY/AZURE_SPEECH_REGION for Azure)")

    renderer = Renderer()
    try:
        for lang in langs:
            todo = [r for r in (planned_render(e, lang, verification) for e in texts[lang]) if not r.path.exists()]
            total = len(texts[lang])
            print(f"{lang}: {total - len(todo)} of {total} clips up to date", end="")
            if args.limit is not None:
                todo = todo[: args.limit]
            print(f", rendering {len(todo)}")
            if not todo:
                continue
            done = [0]
            lock = threading.Lock()
            start = time.time()

            def progress(_r, lang=lang, n=len(todo)) -> None:
                with lock:
                    done[0] += 1
                    if done[0] % 50 == 0 or done[0] == n:
                        print(f"  {lang} {done[0]}/{n} ({time.time() - start:.0f}s)", flush=True)

            renderer.render(todo, on_done=progress)
    finally:
        renderer.close()

    if not args.no_prune and not args.lang and args.limit is None:
        removed = prune(texts, verification)
        save_verification(verification)
        if removed:
            print(f"pruned {removed} unreferenced clips")

    manifest = write_manifest(texts, verification)
    size = sum(f.stat().st_size for f in PUBLIC.rglob("*") if f.is_file())
    counts = ", ".join(f"{lang} {len(manifest[lang])}/{len(texts[lang])}" for lang in LANGS)
    print(f"manifest: {counts}; public/audio is {size / 1e6:.1f} MB")
    missing = sum(len(texts[lang]) - len(manifest[lang]) for lang in LANGS)
    sys.exit(1 if missing and not args.lang and args.limit is None else 0)


if __name__ == "__main__":
    main()
