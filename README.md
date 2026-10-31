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

Progress, settings and reviews are stored in the browser's localStorage. There is no backend and no account. Progress can be exported and imported from Settings.

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
reference/        reference indices built from Wiktionary and Tatoeba
docs/             content guide, curriculum, generated content report
```

Stack: Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, react-router, zustand, ts-fsrs, zod.

## Known limitations

- Browsers rarely ship a Sorani text-to-speech voice, so Sorani audio is often unavailable. Persian usually works. Recorded audio from Wikimedia Commons is used where it exists.
- The course teaches Sulaymani Sorani and Tehrani Persian. Written Persian is the main form, with spoken Tehrani forms alongside.
- This is a first version. Content is checked against references, but native-speaker review is still in progress. Items flagged for review are listed in `docs/content-report.md`.

## Licenses

Reference data: Wiktionary (CC BY-SA 4.0) and Tatoeba (CC BY 2.0 FR). Font: Vazirmatn (SIL OFL). Grammar references: W. M. Thackston, *Sorani Kurdish: A Reference Grammar with Selected Readings*, and D. H. Kim, *A Basic Guide to Kurdish Grammar*.
