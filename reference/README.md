# Reference data

These files are compact indices built from open, human-edited datasets. They are **not** shipped
to the browser. The content validator (`npm run content:check`) and the lookup tool
(`npm run ref -- <word>`) use them to check every word and sentence in the app.

| File | Built from | License |
| --- | --- | --- |
| `en-translations.json` | English Wiktionary translation tables (via [kaikki.org](https://kaikki.org) / wiktextract), English headword to Persian, Central Kurdish and Swedish | CC BY-SA 4.0 / GFDL |
| `fa-wiktionary.json` | Persian entries in English Wiktionary: glosses, romanization, Iranian IPA, Wikimedia Commons audio | CC BY-SA 4.0 / GFDL |
| `ckb-wiktionary.json` | Central Kurdish entries in English Wiktionary | CC BY-SA 4.0 / GFDL |
| `tatoeba-fa.json`, `tatoeba-ckb.json` | [Tatoeba](https://tatoeba.org) sentences (Iranian Persian `pes`, Central Kurdish `ckb`) with their English translations, plus token counts | CC BY 2.0 FR |

Rebuild:

```bash
scripts/fetch-sources.sh raw        # downloads ~3 GB (streamed), keeps ~250 MB in raw/
npx tsx scripts/build-reference.ts raw
```

Notes on quality:

- Tatoeba Central Kurdish text is often typed with Arabic letters (`ة`, `ي`, `ك`). The builder
  converts those to Kurdish letters (`ە`, `ی`, `ک`) before indexing.
- Wiktionary Persian translations include Classical and Dari forms. Prefer forms whose
  romanization uses `â` (Iranian convention) and check the `fa-wiktionary` entry's gloss.
- Neither source is a substitute for a native-speaker review. The app tracks that separately
  (`src/content/reviews/`).
