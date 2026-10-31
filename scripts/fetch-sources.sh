#!/usr/bin/env bash
# Downloads the raw open datasets that `scripts/build-reference.ts` turns into `reference/`.
# ~3 GB is streamed (English Wiktionary); only the filtered result (~25 MB) is kept.
set -euo pipefail
RAW="${1:-raw}"
mkdir -p "$RAW"
cd "$RAW"

tatoeba=https://downloads.tatoeba.org/exports/per_language
for f in pes/pes_sentences ckb/ckb_sentences eng/eng_sentences pes/pes-eng_links ckb/ckb-eng_links; do
  curl -fsSL "$tatoeba/$f.tsv.bz2" | bunzip2 > "$(basename "$f").tsv"
done

curl -fsSL -o fa-wikt.jsonl https://kaikki.org/dictionary/Persian/kaikki.org-dictionary-Persian.jsonl
curl -fsSL -o ckb-wikt.jsonl "https://kaikki.org/dictionary/Central%20Kurdish/kaikki.org-dictionary-CentralKurdish.jsonl"

curl -fsSL https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz | gunzip \
  | python3 "$(dirname "$0")/../scripts/filter_en_translations.py" > en-translations.jsonl
