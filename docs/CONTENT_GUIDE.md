# Content guide

Everything the learner sees in Sorani or Persian lives in JSON under `src/content/data/`. This guide is the contract for writing it. `npm run content:check` enforces most of it and must report **0 errors** before content is merged.

## Principles

1. **Accuracy beats volume.** A wrong word that gets drilled into memory with spaced repetition does real harm. If you are not sure, leave it out or mark the uncertainty in a note.
2. **Verify every form against a reference.** Use `npm run ref` (below) before you write a word. The validator then scores each item's evidence, and the app shows that score to the learner.
3. **Teach what people say.** Prefer the everyday standard word. Put formal or colloquial alternatives in `variants` with a `register`.
4. **Sulaymani Sorani and Tehrani Persian** are the reference dialects. Other dialect forms go in `variants` with `dialect`.
5. **Both languages for every item** when possible. The learner can study one or both, and compare mode shows cognates side by side.
6. **Swedish is not a translation of the English.** Write natural Swedish. `svAlt` and `enAlt` list other answers that should be accepted when the learner types the meaning.

## Files

| Folder | Root key | One file per |
| --- | --- | --- |
| `src/content/data/lexicon/` | `concepts` | unit, e.g. `03-family.json` |
| `src/content/data/sentences/` | `sentences` | unit |
| `src/content/data/qa/` | `items` | unit |
| `src/content/data/grammar/` | `points` | unit |

Files are picked up automatically (`import.meta.glob`). The types are in `src/content/types.ts` and the strict zod schemas in `src/content/schema.ts`. Unknown keys are errors.

Ids are kebab-case and unique within their kind across all files. Concept ids follow `docs/CURRICULUM.md`, which is the shared registry that lets sentence and Q&A tokens refer to words from other units.

## Orthography

### Sorani (`ckb`)

- Use the Kurdish Unicode letters: `ە` (U+06D5) for the vowel *e*, `ه` (U+0647) only for the consonant *h*, plus `ێ ۆ ڵ ڕ ڤ ی ک`.
- Never `ة ي ك ى`, never `ه` + ZWNJ for the vowel, never `ھ`.
- Word-initial *r* is always `ڕ`.
- Vowel-initial words start with `ئ` (ئاو *aw*, ئێوە *êwe*).
- The short *i* is not written (ببوورە *bibûre*, دڵ *dił*).
- Clitics and suffixes attach to the word: ناوم *nawim*, کوڕەکە *kuřeke*, دەخۆم *dexom*.

### Persian (`fa`)

- Iranian letters `ی ک`, never Arabic `ي ك`.
- The verb prefix می/نمی joins with a ZWNJ (U+200C): `می‌خورم`. Same for the plural `ها` (`کتاب‌ها`) and other suffixes after a non-joining letter where standard orthography uses it (`خانه‌ام`).
- No harakat. The one exception is tanwin on alef in words like `لطفاً`, `حتماً`, `واقعاً`.
- The *written* standard goes in `script`. The spoken Tehrani form goes in `variants` with `register: "colloquial"` for words, or in `colloquial` for sentences (e.g. written `می‌خواهم` *mikhâham*, spoken `می‌خوام` *mikhâm*).

## Romanization

Romanization is for learners. It must spell the same consonants as the script, which the validator checks with a consonant skeleton. Mismatches are warnings that almost always mean a typo.

### Sorani: Hawar-style Kurdish Latin

| Script | Latin | | Script | Latin |
| --- | --- | --- | --- | --- |
| ا | a | | ە | e |
| ێ | ê | | ۆ | o |
| و (vowel) | u / û | | ی (vowel) | î |
| و (consonant) | w | | ی (consonant) | y |
| ج | c | | چ | ç |
| ژ | j | | ش | ş |
| خ | x | | غ | ẍ |
| ح | ḧ | | ع | ' |
| ڕ | ř | | ڵ | ł |
| ق | q | | unwritten short vowel | i |

Short *u* is `u`, long `وو` is `û`. No digraphs (`sh`, `ch`, `kh`, `gh`). Lowercase except proper nouns.

### Persian: learner scheme

| Sound | Latin | Example |
| --- | --- | --- |
| long a (ا / آ) | â | آب *âb* |
| short a | a | من *man* |
| short e | e | خانه *khâne* |
| short o | o | دو *do*, گل *gol* |
| long i (ی) | i | سیب *sib* |
| long u (و) | u | دور *dur* |
| diphthongs | ey, ow | خیر *kheyr*, نو *now* |
| خ | kh | خواهر *khâhar* |
| ق and غ | gh | قند *ghand* |
| ش ch ژ | sh, ch, zh | |
| ج | j | |
| و consonant | v | ویژه *vizhe* |
| ی consonant | y | یک *yek* |
| ع / ء | ' | ساعت *sâ'at* |
| ezafe | -e / -ye | خانه‌ی من *khâne-ye man*, کتاب من *ketâb-e man* |

Never `x`, `q`, or `c` without `h`.

## Concepts (lexicon)

```json
{
  "id": "water",
  "unit": "food-drink",
  "pos": "noun",
  "level": "A1",
  "emoji": "💧",
  "gloss": { "en": "water", "sv": "vatten" },
  "cognate": true,
  "ckb": {
    "primary": { "script": "ئاو", "latin": "aw" },
    "sources": [{ "source": "wiktionary", "ref": "water" }, { "source": "tatoeba" }]
  },
  "fa": {
    "primary": { "script": "آب", "latin": "âb" },
    "sources": [{ "source": "wiktionary", "ref": "water" }]
  }
}
```

- Verbs: the concept id is `to-eat` style. `primary` is the infinitive (ckb خواردن *xwardin*, fa خوردن *khordan*). Fill `presentStem` and `pastStem` (ckb خۆ *xo* / خوارد *xward*, fa خور *khor* / خورد *khord*).
- Nouns: add `plural` when it is irregular or useful (Persian `-ân` for people). Regular Sorani `-an` and Persian `-hâ` can be left out.
- `notes` (en + sv) is the best teaching surface in the app. Use it for a memorable fact: usage, a cognate, a trap, a cultural point. One or two sentences.
- `senseNote` disambiguates homonyms in the learner's language ("(the fruit)").
- `emoji` is a memory anchor. Only add one that really fits.
- `gloss.en` must be the plain English headword, so the reference lookup can find it (`to eat`, `mother`, `how much`).

## Sentences

```json
{
  "id": "i-want-water",
  "unit": "food-drink",
  "level": "A1",
  "translation": { "en": "I want water.", "sv": "Jag vill ha vatten." },
  "ckb": {
    "text": "ئاوم دەوێت.",
    "latin": "awim dewêt.",
    "tokens": [
      { "text": "ئاوم", "latin": "awim", "gloss": { "en": "water-my", "sv": "vatten-mitt" }, "concept": "water", "morph": "water-1SG" },
      { "text": "دەوێت.", "latin": "dewêt.", "gloss": { "en": "is wanted", "sv": "önskas" }, "concept": "to-want", "morph": "DUR-want.PRS-3SG" }
    ],
    "grammar": ["ckb-wanting"],
    "sources": [{ "source": "author" }]
  }
}
```

- **Tokens are the written words in reading order** (split on spaces; Persian ZWNJ words stay one token). Tokens become the tiles in the word-bank exercise. Joined with spaces they must equal the sentence text, and the same for `latin`. Keep final punctuation on the last token.
- `concept` links a token to the lexicon. Point inflected forms at the base concept (دەخۆم points at `to-eat`). A sentence only unlocks once every linked concept has been introduced, so only link to concepts that exist in `docs/CURRICULUM.md` from the same or an earlier unit. Function words without a concept just leave it out.
- `gloss` is the meaning of that token in context, shown when the learner taps a word.
- `morph` is an optional Leipzig-style gloss for the grammar view.
- `distractors` are plausible wrong tiles: a wrong person ending, the wrong preposition, a word from the wrong language register. Two or three per sentence.
- `alternatives` are other correct versions (different word order, a synonym). Typed answers accept them.
- `grammar` lists grammar point ids this sentence illustrates.
- Short sentences first. A1 sentences are 2 to 5 words.

## Questions and answers

```json
{
  "id": "what-is-your-name",
  "unit": "me-and-you",
  "level": "A1",
  "question": { "en": "What is your name?", "sv": "Vad heter du?" },
  "personal": true,
  "ckb": {
    "question": { "text": "ناوت چییە؟", "latin": "nawit çiye?", "tokens": [...] },
    "answers": [
      { "text": "ناوم {name}ە.", "latin": "nawim {name}e.", "translation": { "en": "My name is {name}.", "sv": "Jag heter {name}." }, "tokens": [...] }
    ],
    "slots": { "name": [{ "text": "ئاراس", "latin": "Aras", "translation": { "en": "Aras", "sv": "Aras" } }] },
    "sources": [{ "source": "author" }]
  }
}
```

- The question must be answerable with words from the same or earlier units.
- `answers[0]` is the model answer and must have `tokens` (they drive unlocking and the word-bank mode). Give two to four answers that show natural variety: short, full sentence, negative.
- `personal: true` with `{slot}` placeholders for answers about the learner. Provide three to five example values per slot. Slot tokens use `"text": "{name}"` in the tokens array.
- Questions should feel like real conversation, not a grammar drill.

## Grammar points

One point per concept, per language. `id` is prefixed with the language (`ckb-present-tense`, `fa-ezafe`). The explanation is short (under ~120 words), plain, and contrastive with Swedish or English where that helps. It supports `**bold**` and `` `code` `` only. Give two to four examples with tokens.

## Sources

`sources` lists where you checked a form. The validator re-checks Wiktionary and Tatoeba itself, so a false claim does not raise the score.

| source | Use for |
| --- | --- |
| `wiktionary` | Found in the reference index (`ref` = headword) |
| `tatoeba` | Seen in Tatoeba sentences |
| `thackston-sorani-grammar` | W. M. Thackston, *Sorani Kurdish: A Reference Grammar* (`ref` = page or section) |
| `kim-kurdish-grammar` | D. H. Kim, *A Basic Guide to Kurdish Grammar* |
| `asosoft` | AsoSoft corpus or lexicon |
| `native-speaker` | Confirmed by a native speaker (only via the review overlay) |
| `author` | Written by the content author from knowledge, not verified elsewhere |

## Tools

```bash
npm run ref -- water                        # English headword: translations into ckb, fa, sv
npm run ref -- ئاو                          # target word: Wiktionary entries + Tatoeba usage
npm run ref -- --sentences ckb ئاو          # Tatoeba example sentences
npm run ref -- --check ckb "دەخۆم" "dexom"  # lint + romanization check for one form
npm run content:check                       # validate everything, write evidence + report
```

The reference indices in `reference/` come from English, Persian and Central Kurdish Wiktionary and from Tatoeba. Tatoeba Sorani is user-contributed and sometimes uses Arabic letters, so it is normalized on import. Treat it as evidence of usage, not as gospel.

## Evidence levels

The validator writes a level per item to `src/content/generated/evidence.json`, shown in the app as a badge.

| Level | Concept meaning |
| --- | --- |
| native-reviewed | Approved in `src/content/reviews/` by a native speaker |
| strong | Wiktionary translation table lists it for this meaning, and an entry gloss or Tatoeba usage agrees |
| good | One Wiktionary source agrees |
| attested | The word exists in a reference, but the meaning was not confirmed |
| none | Not found anywhere. Allowed, but think twice |

Sentences are scored by how many of their words are attested.

## Native review

Native speakers review items in the app at `/review` and export a JSON file. It goes into `src/content/reviews/` as:

```json
{
  "reviews": [
    { "key": "concept:ckb:water", "verdict": "correct", "reviewer": "Name", "date": "2026-10-31" },
    { "key": "sentence:fa:i-want-water", "verdict": "incorrect", "reviewer": "Name", "date": "2026-10-31", "comment": "Say آب می‌خوام" }
  ]
}
```

Keys are `concept|sentence|qa:<lang>:<id>`. The latest review per key wins. `correct` makes the item native-reviewed. `incorrect` drops it to none and prints the comment as a validator warning.
