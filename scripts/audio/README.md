# Audio pipeline

Pre-generates a neural TTS clip for every Sorani and Persian text in the course, so the app can play
audio without any API key at runtime. Needs Python 3.11+, `ffmpeg`, and the packages in
`requirements.txt`. Use a virtual environment: Audio8 needs transformers 4.x, which may conflict with
other projects.

```sh
python3 -m venv .venv && . .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r scripts/audio/requirements.txt

npm run audio:build    # collect texts from src/content/data, render missing clips, write public/audio/manifest.json
npm run audio:verify   # speech-recognition round trip, retry weak clips, write docs/audio-report.md
```

Everything runs on CPU. On 8 cores a full Sorani render takes about an hour (about 3 s per clip), and the
Sorani verification about 1.5 hours (about 5 s per clip). Both are incremental and resumable: finished clips and their
scores are kept, so an interrupted run carries on where it stopped and later runs only touch changed texts.
Models are downloaded on first use to `scripts/audio/.models/` (gitignored, about 6 GB with the recogniser).

- `collect-texts.ts` gathers words (primary, variants, plurals), sentences (+ colloquial and alternatives),
  questions, answers (templates filled with their example slot values) and grammar examples, keyed by
  canonical text (`canonicalize` from `src/lib/script/normalize`). Output: `.texts.json` (gitignored).
- `generate.py` renders clips to `public/audio/<lang>/<sha1(lang, voice, rate, text[, take])[:16]>.mp3`
  (mono 24 kHz, 48 kbps, loudness −16 LUFS, ~80 ms of silence at each end). Existing files are reused,
  unused ones pruned.
- `verify.py` transcribes each new clip and scores it by character error rate (CER) against the intended
  text. Weak Sorani clips are re-rendered as two new Audio8 takes (other random seeds) and with Berfin;
  weak Persian clips slower and with the other voice. The clearly better one is kept. Results live in
  `verification.json` (committed, so reruns only check new clips).
- `audio8.py` is the Sorani engine. `ckb_normalize.py` is its text normalizer, copied from
  [Audio8-Persian-TTS](https://github.com/ard9/Audio8-Persian-TTS) (Apache-2.0, see
  `LICENSE-audio8-normalizer`); the model was trained on text normalized exactly this way.
- `compare.py` is the Sorani engine comparison, run when choosing the engine. `engine-comparison.json`
  holds the numbers behind the current choice.

## Voices

| Language | Voice | Engine | License |
| --- | --- | --- | --- |
| Persian | Dilara (words, sentences, answers), Farid (questions) | Microsoft neural TTS | Azure AI Speech terms |
| Sorani | Audio8 Sorani, default voice | [Audio8-TTS-Kurdish-Sorani](https://huggingface.co/ArminRahimi/Audio8-TTS-Kurdish-Sorani), a 0.6B DualAR model by Armin Rahimi Darehbagh, based on [Audio8 TTS](https://github.com/Edge0-AI/Audio8_TTS) by Edge0-AI | **CC BY-NC 4.0, non-commercial only** (trained on [central-kurdish-tts4all](https://huggingface.co/datasets/aranemini/central-kurdish-tts4all), CC BY-NC-ND 4.0) |
| Sorani (fallback) | Berfin, only where it verifies clearly better | [Vekol-TTS](https://huggingface.co/RevgeAI/vekol-tts-ckb-edge), Piper VITS | CC BY-NC 4.0, non-commercial only |

Because both Sorani voices are licensed for non-commercial use only, the app may not be used
commercially while it ships these clips.

Audio8 samples its output, so the same text reads slightly differently per take. Now and then a single
word comes out with a babbled syllable appended; `audio8.py` detects that from the clip length (about
twice what the text needs) and re-samples before writing the clip, and verification catches the rest.
It has no speed control: isolated words are read at its natural pace, and a nonzero rate is applied as
a time-stretch.

Persian uses the official Azure Speech REST API when `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are
set (use this for production), and otherwise Edge's read-aloud service with the same voices. The voice
id is part of the file name, so switching engine does not invalidate existing clips; delete
`public/audio/fa` to re-render them.

## Recognisers

Downloaded on first use; CPU is fine. Override with `AUDIO_ASR_FA` / `AUDIO_ASR_CKB` (comma-separated
specs, see `asr.py`; with several, the best score counts).

- Persian: `faster-whisper` medium (int8).
- Sorani: [rzgar/whisper-large-v3-sorani-kurdish-ckb-v2](https://huggingface.co/rzgar/whisper-large-v3-sorani-kurdish-ckb-v2),
  converted once to CTranslate2 with float16 weights and run with float32 compute (about 9 GB of RAM).
  int8 weights break this fine-tune (English tokens leak into the transcripts), and it must be decoded
  with the Persian language token, which is how it was trained. The repo lacks the large-v3 feature
  extractor config; `asr.py` writes it.

The app looks clips up in `public/audio/manifest.json` by canonical text (`src/lib/audio.ts`), so a
text changed in the content needs `npm run audio:build` before it has audio again; until then the app
falls back to the browser's speech synthesis where one exists.
