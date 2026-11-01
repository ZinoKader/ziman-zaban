"""Checks every clip with a speech-recognition round trip, retries weak clips, writes docs/audio-report.md.

    python3 scripts/audio/verify.py [--lang ckb|fa] [--no-retry] [--force] [--baseline]

Per-clip results are kept in scripts/audio/verification.json, so later runs only check new clips.
The character error rate (CER) compares the recognised text with the intended text after the same
folding the app uses for answer matching (spacing, punctuation, hamza and h/e variants ignored).
With several recognisers per language the best score counts: a clip is suspect only if none of
them understands it.
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
import urllib.request
from datetime import date

from asr import RECOGNIZERS, Recognizer
from common import (
    ALTERNATE_VOICE,
    HERE,
    LANGS,
    ROOT,
    VOICES,
    Render,
    Renderer,
    azure_configured,
    cer,
    choice_key,
    default_render,
    load_texts,
    load_verification,
    planned_render,
    prune,
    save_verification,
    voice_rate,
    write_manifest,
)

# Single words give a recogniser no context, so they get a looser threshold.
THRESHOLD = {"word": 0.5, "*": 0.35}
SLOWER = -15
REPORT = ROOT / "docs" / "audio-report.md"
COMPARISON = HERE / "engine-comparison.json"
BASELINE = HERE / "baseline.json"
USER_AGENT = "ZimanZaban-audio-check/1.0 (language-learning app; verifies Commons pronunciations)"


def threshold(kind: str) -> float:
    return THRESHOLD.get(kind, THRESHOLD["*"])


def transcribe_all(lang: str, files: list[str], specs: list[str], on_done=None) -> dict[str, dict[str, str]]:
    """Returns {file: {spec: hypothesis}}, loading one recogniser at a time. `on_done(file, hyps)` runs as soon
    as a file has been heard by every recogniser, so callers can save progress."""
    out: dict[str, dict[str, str]] = {f: {} for f in files}
    if not files:
        return out
    for n, spec in enumerate(specs, 1):
        start = time.time()
        rec = Recognizer(spec, lang)
        for i, f in enumerate(files, 1):
            out[f][spec] = rec.transcribe(ROOT / "public" / "audio" / f)
            if on_done and n == len(specs):
                on_done(f, out[f])
            if i % 50 == 0 or i == len(files):
                print(f"  {lang} {spec.split('/')[-1]}: {i}/{len(files)} ({time.time() - start:.0f}s)", flush=True)
        rec.close()
    return out


def scorer(verification: dict, text_of: dict[str, str], lang: str):
    """Stores each clip's score as it comes in and saves verification.json every 25 clips."""
    count = [0]

    def on_done(f: str, hyps: dict[str, str]) -> None:
        verification["clips"][f] = score(text_of[f], lang, hyps)
        count[0] += 1
        if count[0] % 25 == 0:
            save_verification(verification)

    return on_done


def score(text: str, lang: str, hyps: dict[str, str]) -> dict:
    by = {spec: round(cer(text, h, lang), 3) for spec, h in hyps.items()}
    best = min(by, key=by.get)
    return {"cer": by[best], "hyp": hyps[best], "by": by}


def candidates(r: Render, kind: str) -> list[Render]:
    alt = ALTERNATE_VOICE.get(r.voice)
    if VOICES[r.voice]["engine"] == "audio8":
        # A sampling engine misreads differently each time, so new takes come first; slowing it down does not help.
        out = [Render(r.lang, r.voice, r.rate, r.text, take) for take in (1, 2)]
        return out + ([Render(r.lang, alt, voice_rate(alt, kind), r.text)] if alt else [])
    out = [Render(r.lang, r.voice, r.rate + SLOWER, r.text)]
    if alt:
        out += [Render(r.lang, alt, r.rate, r.text), Render(r.lang, alt, r.rate + SLOWER, r.text)]
    return out


def verify_lang(lang: str, texts: list[dict], verification: dict, retry: bool, force: bool) -> None:
    specs = RECOGNIZERS[lang]
    clips = verification["clips"]
    entries = {e["text"]: e for e in texts}
    plan = {e["text"]: planned_render(e, lang, verification) for e in texts}
    pending = sorted({r.file for r in plan.values() if r.path.exists() and (force or r.file not in clips)})
    print(f"{lang}: checking {len(pending)} of {len(plan)} clips")
    text_of = {r.file: t for t, r in plan.items()}
    transcribe_all(lang, pending, specs, scorer(verification, text_of, lang))
    save_verification(verification)

    if not retry:
        return
    weak = [
        t
        for t, r in plan.items()
        if r.file in clips
        and clips[r.file]["cer"] > threshold(entries[t]["kind"])
        and choice_key(lang, t) not in verification["choices"]
    ]
    if not weak:
        return
    print(f"{lang}: retrying {len(weak)} weak clips with other voices/rates")
    tries: dict[str, list[Render]] = {}
    for t in weak:
        base = default_render(lang, entries[t]["kind"], t)
        tries[t] = [plan[t]] + [c for c in candidates(base, entries[t]["kind"]) if c != plan[t]]
    todo = [c for cs in tries.values() for c in cs[1:] if not c.path.exists()]
    renderer = Renderer()
    try:
        renderer.render(todo)
    finally:
        renderer.close()
    retry_text = {c.file: c.text for cs in tries.values() for c in cs}
    new = sorted(f for f in retry_text if f not in clips and (ROOT / "public" / "audio" / f).exists())
    transcribe_all(lang, new, specs, scorer(verification, retry_text, lang))
    save_verification(verification)
    for t, cs in tries.items():
        cs = [c for c in cs if c.file in clips]
        # Ties keep the earlier (default) render; a retry has to be clearly better to replace it.
        best = cs[0]
        for c in cs[1:]:
            if clips[c.file]["cer"] < clips[best.file]["cer"] - 0.05:
                best = c
        choice = {"voice": best.voice, "rate": best.rate, "tried": len(cs)}
        if best.take:
            choice["take"] = best.take
        verification["choices"][choice_key(lang, t)] = choice
    save_verification(verification)


def human_baseline(verification: dict) -> dict | None:
    """ASR score on the Wikimedia Commons recordings of Persian words, to calibrate word-level CER."""
    evidence = json.loads((ROOT / "src/content/generated/evidence.json").read_text())
    primaries: dict[str, str] = {}
    for f in sorted((ROOT / "src/content/data/lexicon").glob("*.json")):
        for c in json.loads(f.read_text()).get("concepts", []):
            if c.get("fa"):
                primaries[c["id"]] = c["fa"]["primary"]["script"]
    cache = HERE / ".baseline"
    cache.mkdir(exist_ok=True)
    items = []
    for key, ev in evidence.items():
        _, lang, cid = key.split(":", 2)
        if key.startswith("concept:fa:") and ev.get("audio") and cid in primaries:
            dest = cache / f"{cid}.mp3"
            if not dest.exists():
                # Wikimedia rate-limits bursts and anonymous user agents.
                req = urllib.request.Request(ev["audio"], headers={"User-Agent": USER_AGENT})
                try:
                    with urllib.request.urlopen(req, timeout=60) as r:
                        dest.write_bytes(r.read())
                except Exception as e:
                    print(f"  could not fetch {ev['audio']}: {e}")
                    continue
                finally:
                    time.sleep(2)
            items.append((cid, primaries[cid], dest))
    if not items:
        return None
    hyps: dict[str, dict[str, str]] = {cid: {} for cid, _, _ in items}
    for spec in RECOGNIZERS["fa"]:
        rec = Recognizer(spec, "fa")
        for cid, _, path in items:
            hyps[cid][spec] = rec.transcribe(path)
        rec.close()
    rows = [{"id": cid, "text": text, **score(text, "fa", hyps[cid])} for cid, text, _ in items]
    out = {"recogniser": RECOGNIZERS["fa"], "n": len(rows), "rows": rows}
    BASELINE.write_text(json.dumps(out, ensure_ascii=False, indent=0) + "\n")
    return out


# ---------- report ----------


def dist(values: list[float]) -> str:
    if not values:
        return "| 0 | | | | | |"
    n = len(values)
    pct = lambda p: f"{100 * sum(1 for v in values if p(v)) / n:.0f}%"  # noqa: E731
    return (
        f"| {n} | {statistics.mean(values):.3f} | {statistics.median(values):.3f} | {pct(lambda v: v == 0)} "
        f"| {pct(lambda v: v <= 0.25)} | {pct(lambda v: v > 0.35)} |"
    )


def report(texts: dict[str, list[dict]], verification: dict) -> str:
    clips = verification["clips"]
    lines = [
        "# Audio report",
        "",
        f"Generated by `npm run audio:verify` on {date.today().isoformat()}. Do not edit by hand.",
        "",
        "Every Sorani and Persian text in the course has a pre-generated clip in `public/audio`. The clips are",
        "synthesized, not recorded by people. Each one is checked by transcribing it with speech recognition",
        "and comparing the result with the intended text (character error rate, CER, after the folding used",
        "for answer matching). A high CER means the recogniser did not hear the intended text; that can be",
        "the voice's fault or the recogniser's, so flagged clips need a native listener.",
        "",
        "## Engines and voices",
        "",
        "| Voice | Language | Engine | Used for | License / credit |",
        "| --- | --- | --- | --- | --- |",
        f"| Dilara (`fa-IR-DilaraNeural`) | Persian | Microsoft neural TTS ({'Azure Speech API' if azure_configured() else 'via Edge read-aloud; set AZURE_SPEECH_KEY for the Azure API'}) | words, sentences, answers | Microsoft Azure AI Speech |",
        "| Farid (`fa-IR-FaridNeural`) | Persian | Microsoft neural TTS | questions (a second speaker for dialogues) | Microsoft Azure AI Speech |",
        "| Audio8 Sorani (default voice) | Sorani | Audio8 TTS, 0.6B DualAR (`ArminRahimi/Audio8-TTS-Kurdish-Sorani`) | everything | CC BY-NC 4.0, Audio8-TTS-Kurdish-Sorani by Armin Rahimi Darehbagh, base model Audio8 TTS by Edge0-AI (Apache-2.0), trained on central-kurdish-tts4all: non-commercial use only |",
        "| Berfin | Sorani | Vekol-TTS, Piper VITS (`RevgeAI/vekol-tts-ckb-edge`) | fallback, only clips where it verifies clearly better | CC BY-NC 4.0, Vekol-TTS by Darvan Shvan / Revge: non-commercial use only |",
        "",
        "Recognisers: " + "; ".join(f"{lang}: " + ", ".join(f"`{s}`" for s in RECOGNIZERS[lang]) for lang in LANGS) + ".",
        "",
    ]
    if COMPARISON.exists():
        comp = json.loads(COMPARISON.read_text())
        lines += [
            "## Sorani engine comparison",
            "",
            f"Same {comp['n']} items ({comp.get('words', comp['n'] // 2)} single words), mean CER per recogniser (lower is better),"
            " and naturalness estimates where measured (UTMOS, DNSMOS overall; higher is better):",
            "",
            "| Engine | " + " | ".join(f"`{s.split(':', 1)[1].split('/')[-1]}`" for s in comp["asr"]) + " | UTMOS | DNSMOS |",
            "| --- | " + " | ".join("---" for _ in comp["asr"]) + " | --- | --- |",
        ]
        for engine, label in comp["engines"].items():
            cells, mos = [], {}
            for s in comp["asr"]:
                r = comp["results"].get(s, {}).get(engine)
                cells.append(f"{r['mean']:.3f} (words {r['words']:.3f}, sentences {r['sentences']:.3f})" if r else "")
                mos = {k: r[k] for k in ("utmos", "dnsmos") if r and k in r} or mos
            cells += [f"{mos['utmos']:.2f}" if "utmos" in mos else "", f"{mos['dnsmos']:.2f}" if "dnsmos" in mos else ""]
            lines.append(f"| {label} | " + " | ".join(cells) + " |")
        lines += ["", comp.get("note", ""), ""]

    baseline = json.loads(BASELINE.read_text()) if BASELINE.exists() else None
    flagged = []
    for lang in LANGS:
        rows: dict[str, list[float]] = {}
        voices: dict[str, int] = {}
        for e in texts[lang]:
            r = planned_render(e, lang, verification)
            v = clips.get(r.file)
            voices[r.voice] = voices.get(r.voice, 0) + 1
            if not v:
                continue
            rows.setdefault(e["kind"], []).append(v["cer"])
            if v["cer"] > threshold(e["kind"]):
                flagged.append((lang, e, r, v))
        name = {"ckb": "Sorani", "fa": "Persian"}[lang]
        lines += [
            f"## {name} ({len(texts[lang])} clips)",
            "",
            "Voices: " + ", ".join(f"{VOICES[v]['name']} {n}" for v, n in sorted(voices.items(), key=lambda x: -x[1])) + ".",
            "",
            "| Kind | Clips | Mean CER | Median | Perfect | CER ≤ 0.25 | CER > 0.35 |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
        for kind in ("word", "question", "answer", "sentence", "grammar"):
            if kind in rows:
                lines.append(f"| {kind} {dist(rows[kind])}")
        lines.append(f"| **all** {dist([c for vs in rows.values() for c in vs])}")
        lines.append("")
        if lang == "fa" and baseline:
            b = [r["cer"] for r in baseline["rows"]]
            lines += [
                f"Baseline: the same recogniser on {baseline['n']} human recordings of Persian words from Wikimedia Commons",
                f"scores mean CER {statistics.mean(b):.3f} (median {statistics.median(b):.3f}, perfect {100 * sum(1 for v in b if v == 0) / len(b):.0f}%).",
                "Word-level CER is therefore partly recogniser noise. Where a human recording exists the app plays it instead of the clip.",
                "",
            ]
    kinds = {choice_key(lang, e["text"]): e["kind"] for lang in LANGS for e in texts[lang]}
    retried = len(verification["choices"])
    changed = 0
    for key, c in verification["choices"].items():
        lang, text = key.split("|", 1)
        d = default_render(lang, kinds.get(key, "sentence"), text)
        changed += (c["voice"], c["rate"], c.get("take", 0)) != (d.voice, d.rate, 0)
    lines += [
        "## Retries",
        "",
        f"{retried} clips scored above the threshold (CER > {THRESHOLD['*']} for sentences, > {THRESHOLD['word']} for single words) and were re-rendered:",
        "Sorani as two new Audio8 takes and with Berfin, Persian slower and with the other voice.",
        f"{changed} of them now use a different take, voice or rate because it verified clearly better.",
        "",
        f"## Flagged for native review ({len(flagged)})",
        "",
        "Still above the threshold after retries. The recogniser's transcript shows what it heard.",
        "",
        "| Lang | Kind | Text | Romanization | CER | Heard | Used in |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for lang, e, _r, v in sorted(flagged, key=lambda x: (x[0], -x[3]["cer"])):
        refs = ", ".join(e["refs"][:3]) + (" …" if len(e["refs"]) > 3 else "")
        lines.append(
            f"| {lang} | {e['kind']} | {e['text']} | {e['latin']} | {v['cer']:.2f} | {v['hyp'] or '(nothing)'} | {refs} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=LANGS)
    ap.add_argument("--no-retry", action="store_true")
    ap.add_argument("--force", action="store_true", help="re-check clips that already have a result")
    ap.add_argument("--baseline", action="store_true", help="also score human Persian recordings from Commons")
    ap.add_argument("--report-only", action="store_true")
    args = ap.parse_args()

    texts = load_texts()
    verification = load_verification()
    if not args.report_only:
        for lang in [args.lang] if args.lang else LANGS:
            verify_lang(lang, texts[lang], verification, retry=not args.no_retry, force=args.force)
        if args.baseline:
            human_baseline(verification)
        if not args.lang:
            prune(texts, verification)
            save_verification(verification)
    write_manifest(texts, verification)
    REPORT.write_text(report(texts, verification))
    print(f"wrote {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
