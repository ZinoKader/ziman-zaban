"""Keeps English Wiktionary entries that have Persian, Central Kurdish or Swedish translations.

Reads wiktextract JSONL on stdin, writes compact JSONL on stdout.
"""
import json
import sys

CODES = {"fa", "ckb", "sv"}


def pick(t, sense=None):
    d = {k: t.get(k) for k in ("code", "lang_code", "word", "roman", "sense", "tags") if t.get(k)}
    if sense and "sense" not in d:
        d["sense"] = sense
    return d


for line in sys.stdin:
    if '"translations"' not in line:
        continue
    try:
        e = json.loads(line)
    except ValueError:
        continue
    if e.get("lang_code") != "en":
        continue
    trans = [pick(t) for t in e.get("translations") or [] if (t.get("code") or t.get("lang_code")) in CODES]
    for s in e.get("senses") or []:
        gloss = (s.get("glosses") or [""])[0]
        trans += [pick(t, gloss) for t in s.get("translations") or [] if (t.get("code") or t.get("lang_code")) in CODES]
    if trans:
        sys.stdout.write(json.dumps({"word": e.get("word"), "pos": e.get("pos"), "t": trans}, ensure_ascii=False) + "\n")
