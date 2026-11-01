# Ziman·Zabân

Learn to **speak** Sorani Kurdish (کوردیی سۆرانی) and Persian (فارسی), from Swedish or English.

*Ziman* (زمان) is "language" in Sorani, *zabân* (زبان) is "language" in Persian. The app teaches both side by side, so a learner can study one or both and see where they meet.

## The four modules

Each module is one step on the path from understanding a word to holding a conversation.

| Step | Module | Direction | Unlocks when |
| --- | --- | --- | --- |
| 1 | Recognition | Sorani/Persian to Swedish/English | Always open |
| 2 | Recall | Swedish/English to Sorani/Persian, from memory | The word was recognised 3 times |
| 3 | Sentences | Build whole sentences from known words | All of the sentence's words were introduced |
| 4 | Conversation | Hear a question in Sorani/Persian, answer in the same language | Most of its words can be recalled |

Exercises get harder as a card matures. Recognition goes from multiple choice to listening to typed meanings. Recall goes from typed answers to saying the word aloud. Sentences go from word tiles to a cloze to typing the full sentence. Conversation goes from choosing an answer to building it from tiles to answering freely by typing or recording yourself.

Scheduling uses [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) with a 90% retention target. Every answer gets immediate feedback with audio, romanization, a word-by-word gloss and grammar links. The Method & sources page in the app (`/about`) explains the research behind each choice.

## Running it

Requires Node 20+.

```bash
npm install
npm run dev          # http://localhost:41731
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 41731 |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm test` | Unit and component tests (vitest) |
| `npm run lint` | oxlint |
| `npm run content:check` | Validate all course content and regenerate the evidence report |
| `npm run ref -- <word>` | Look a word up in the reference data |
| `npm run audio:build` | Render missing pronunciation clips into `public/audio/` (Python, see below) |
| `npm run audio:verify` | Check every clip with speech recognition and retry weak ones |

## Progress and storage

There is no backend and no account. Progress and settings are saved on the device after every answer, in the browser's IndexedDB (database `ziman-zaban`, through `idb-keyval`; see `src/store/device-storage.ts`). Data from older versions, which used localStorage, is migrated on first load. Where IndexedDB is unavailable or fails (some private browsing modes), the app falls back to localStorage, and to memory if storage is blocked entirely. On the first save the app asks the browser to keep the data persistent, so it is not cleared to free up space. Native-review verdicts and personal answers stay in localStorage.

The Progress page (`/progress`) shows, per language, the words learned and in progress, each module and unit, the last 14 days of activity, accuracy over the last 7 days, the reviews coming up, the streak and the hardest words. It also says where the data is saved, when it was last saved and whether the browser protects it. Progress can be exported and imported from Settings.

## Audio

Every Sorani and Persian text has a pre-generated pronunciation clip in `public/audio/` (mono MP3, 48 kbps), looked up by canonical text in `public/audio/manifest.json`. No speech API is called at runtime. A recording by a native speaker, where one exists (Wikimedia Commons), is played instead, and the browser's speech synthesis is the last resort.

| Language | Voice | License |
| --- | --- | --- |
| Sorani | [Audio8-TTS-Kurdish-Sorani](https://huggingface.co/ArminRahimi/Audio8-TTS-Kurdish-Sorani) (default voice), by Armin Rahimi Darehbagh, based on [Audio8 TTS](https://github.com/Edge0-AI/Audio8_TTS) by Edge0-AI; [Vekol-TTS](https://huggingface.co/RevgeAI/vekol-tts-ckb-edge) Berfin as fallback | CC BY-NC 4.0 |
| Persian | Microsoft neural voices Dilara and Farid (Azure Speech, or Edge read-aloud) | Azure AI Speech terms |

**Both Sorani voices are licensed for non-commercial use only**, so the app may not be used commercially while it ships these clips.

The clips are rebuilt with a Python pipeline in `scripts/audio/` (CPU only, models downloaded on first use; see [`scripts/audio/README.md`](scripts/audio/README.md) for setup). Run it inside the pipeline's virtual environment, because Audio8 needs transformers 4.x:

```bash
npm run audio:build    # collect texts, render missing clips, update the manifest
npm run audio:verify   # speech-recognition round trip, retry weak clips, write docs/audio-report.md
```

Both steps are incremental, so after a content edit only new or changed texts are rendered and checked. `docs/audio-report.md` lists the scores and the clips still flagged for a native listener.

## Deploying

Every push to `main` deploys to GitHub Pages at <https://zinokader.github.io/ziman-zaban/> through `.github/workflows/deploy.yml`. The workflow runs `content:check`, the tests, typecheck and lint, then `npm run build:pages` with `BASE_PATH=/ziman-zaban/`. It can also be started by hand from the Actions tab. The repository's Pages source must be set to "GitHub Actions".

`build:pages` copies `index.html` to `404.html` so that deep links and refreshes load the app instead of the Pages 404. Builds without `BASE_PATH` (`npm run dev`, `npm run build`) serve from `/`. To try the Pages build locally:

```bash
BASE_PATH=/ziman-zaban/ npm run build:pages
```

Then serve `dist/` under `/ziman-zaban/`.

## How accuracy works

Course content is JSON under `src/content/data/`. Nothing reaches the learner without passing `npm run content:check`, which:

1. Validates every file against strict zod schemas (`src/content/schema.ts`).
2. Lints orthography. Sorani must use Kurdish Unicode letters (ە not ه+ZWNJ, word-initial ڕ, no Arabic ي ك ة). Persian must use Iranian ی ک, ZWNJ after می, and no stray harakat.
3. Checks that each romanization spells the same consonants as the script.
4. Checks that sentence tokens add up to the sentence and link to real words.
5. Scores every word, sentence and question against reference data built from English, Persian and Central Kurdish Wiktionary and the Tatoeba corpus.

The score is shown to the learner as an evidence badge: native-reviewed, strong, good, attested or none. Native speakers can review items at `/review` and export their verdicts, which go into `src/content/reviews/` and upgrade items to native-reviewed. Learners can report a problem on any word.

`docs/content-report.md` has the current numbers. To rebuild the reference data from the original dumps, see `reference/README.md` and `scripts/fetch-sources.sh`.

## Writing content

Read [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md) for orthography, romanization and file formats, and [`docs/CURRICULUM.md`](docs/CURRICULUM.md) for the unit plan and reserved word ids. The usual loop:

```bash
npm run ref -- water                         # translations of an English word
npm run ref -- ئاو                           # entries and corpus usage of a target word
npm run ref -- --check ckb "دەخۆم" "dexom"   # lint one form
npm run content:check
```

## Project layout

```
src/
  app/            layout and routes
  content/        types, schemas, loader, data/*.json, generated evidence
  features/       one folder per module and page (recognition, recall, construction,
                  response, words, grammar, alphabet, about, review, settings, session)
  components/     shared UI (target-language text, audio, answer input, script keyboard)
  lib/            script normalization and matching, FSRS wrapper, curriculum, audio
  store/          persisted progress and settings (zustand)
  i18n/           English and Swedish UI strings
scripts/          content validator, reference builder, lookup CLI
scripts/audio/    pronunciation audio pipeline (Python)
public/audio/     generated clips and manifest
reference/        reference indices built from Wiktionary and Tatoeba
docs/             content guide, curriculum, generated content and audio reports
```

Stack: Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, react-router, zustand, ts-fsrs, zod.

## Known limitations

- The audio is synthesized, not recorded by people. Every clip passes an automatic speech-recognition check, but a machine voice can still stress or pronounce a word wrongly; flagged clips are listed in `docs/audio-report.md`.
- The course teaches Sulaymani Sorani and Tehrani Persian. Written Persian is the main form, with spoken Tehrani forms alongside.
- This is a first version. Content is checked against references, but native-speaker review is still in progress. Items flagged for review are listed in `docs/content-report.md`.

## Licenses

Reference data: Wiktionary (CC BY-SA 4.0) and Tatoeba (CC BY 2.0 FR). Font: Vazirmatn (SIL OFL). Sorani audio: Audio8-TTS-Kurdish-Sorani and Vekol-TTS (both CC BY-NC 4.0, non-commercial). Persian audio: Microsoft Azure neural voices. The Sorani text normalizer in `scripts/audio/ckb_normalize.py` is from Audio8-Persian-TTS (Apache-2.0). Grammar references: W. M. Thackston, *Sorani Kurdish: A Reference Grammar with Selected Readings*, and D. H. Kim, *A Basic Guide to Kurdish Grammar*.
