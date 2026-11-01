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

ParsVoice (Persian sentences) needs a second virtual environment, because its XTTS fork needs numpy 1.x
and an older transformers. The pipeline starts it as a worker process. Its weights are gated: accept the
terms on the [model page](https://huggingface.co/MohammadJRanjbar/ParsVoice-XTTS) and export `HF_TOKEN`.

```sh
python3.12 -m venv .venv-parsvoice
.venv-parsvoice/bin/pip install torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu
.venv-parsvoice/bin/pip install -r scripts/audio/requirements-parsvoice.txt
export HF_TOKEN=...          # read access to the gated model
# optional: PARSVOICE_PYTHON=/path/to/python (default .venv-parsvoice/bin/python), PARSVOICE_WORKERS=2
```

Everything runs on CPU. On 8 cores a full Sorani render takes about an hour (about 3 s per clip), the
ParsVoice part of Persian about an hour and a half (about 6 s per clip with two workers), and the
Sorani verification about 1.5 hours (about 5 s per clip). Both are incremental and resumable: finished clips and their
scores are kept, so an interrupted run carries on where it stopped and later runs only touch changed texts.
Models are downloaded on first use to `scripts/audio/.models/` (gitignored, about 12 GB with ParsVoice and the recognisers).

- `collect-texts.ts` gathers words (primary, variants, plurals), sentences (+ colloquial and alternatives),
  questions, answers (templates filled with their example slot values) and grammar examples, keyed by
  canonical text (`canonicalize` from `src/lib/script/normalize`). Output: `.texts.json` (gitignored).
- `generate.py` renders clips to `public/audio/<lang>/<sha1(lang, voice, rate, text[, take])[:16]>.mp3`
  (mono 24 kHz, 48 kbps, loudness −16 LUFS, ~80 ms of silence at each end). Existing files are reused,
  unused ones pruned.
- `verify.py` transcribes each new clip and scores it by character error rate (CER) against the intended
  text. Weak Audio8 clips are re-rendered as two new takes (other random seeds) and with the fallback
  voice (Berfin for Sorani, Dilara for Persian words); weak ParsVoice clips with the other ParsVoice
  speaker and with Audio8. The clearly better one is kept. Results live in `verification.json`
  (committed, so reruns only check new clips).
- `parsvoice.py` is the ParsVoice worker. `refs/parsvoice-a.wav` and `refs/parsvoice-b.wav` are the
  reference clips its two voices are cloned from: Mozilla Common Voice recordings (CC0, via
  `pymmdrza/Common-Voice-Speech-26.0-Persian-Clean`), picked among Common Voice, Mana-TTS and
  GPTInformal reference candidates by how well speech recognition understood their renders of course
  sentences.
- `audio8.py` is the Sorani engine. `ckb_normalize.py` is its text normalizer, copied from
  [Audio8-Persian-TTS](https://github.com/ard9/Audio8-Persian-TTS) (Apache-2.0, see
  `LICENSE-audio8-normalizer`); the model was trained on text normalized exactly this way.
- `compare.py` is the Sorani engine comparison, run when choosing the engine. `engine-comparison.json`
  holds the numbers behind the current choice.

## Voices

| Language | Voice | Engine | License |
| --- | --- | --- | --- |
| Persian | ParsVoice A (sentences, answers, grammar examples) and ParsVoice B (questions) | [ParsVoice-XTTS](https://huggingface.co/MohammadJRanjbar/ParsVoice-XTTS), Coqui XTTS-v2 fine-tuned on the ParsVoice corpus (2,200 h, 1,800+ speakers), zero-shot clones of two Common Voice speakers | **Coqui Public Model License, non-commercial only** (the model card's metadata says MIT, its text CPML; CPML is assumed) |
| Persian | Audio8 Persian, default voice: single words, and sentences where ParsVoice does not verify | [Audio8-TTS-Persian](https://huggingface.co/ArminRahimi/Audio8-TTS-Persian), the same 0.6B DualAR model, trained on Mana-TTS and GPTInformal-Persian | **CC BY-NC 4.0, non-commercial only** |
| Persian (fallback) | Dilara, Farid, only where verification picks them for a word | Microsoft neural TTS | Azure AI Speech terms |
| Sorani | Audio8 Sorani, default voice | [Audio8-TTS-Kurdish-Sorani](https://huggingface.co/ArminRahimi/Audio8-TTS-Kurdish-Sorani), a 0.6B DualAR model by Armin Rahimi Darehbagh, based on [Audio8 TTS](https://github.com/Edge0-AI/Audio8_TTS) by Edge0-AI | **CC BY-NC 4.0, non-commercial only** (trained on [central-kurdish-tts4all](https://huggingface.co/datasets/aranemini/central-kurdish-tts4all), CC BY-NC-ND 4.0) |
| Sorani (fallback) | Berfin, only where it verifies clearly better | [Vekol-TTS](https://huggingface.co/RevgeAI/vekol-tts-ckb-edge), Piper VITS | CC BY-NC 4.0, non-commercial only |

Because the Audio8 and Vekol voices are licensed for non-commercial use only, the app may not be used
commercially while it ships these clips.

Audio8 samples its output, so the same text reads slightly differently per take. Now and then a single
word comes out with a babbled syllable appended; `audio8.py` detects that from the clip length (about
twice what the text needs) and re-samples before writing the clip, and verification catches the rest.
It has no speed control: isolated words are read at its natural pace, and a nonzero rate is applied as
a time-stretch.

The Persian fallback voices use the official Azure Speech REST API when `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are
set (use this for production), and otherwise Edge's read-aloud service with the same voices. The voice
id is part of the file name, so switching engine does not invalidate existing clips.

ParsVoice does not stop on short inputs: under about three seconds of speech it babbles. `parsvoice.py`
therefore reads every text after a fixed carrier sentence and cuts the clip at the pause between them,
which works for sentences but not for single words, so words stay with Audio8. Its inference settings
(from the model's notebook) are close to greedy, so a text reads the same way every time; a weak clip
is retried with the other speaker, then with Audio8. On ten course sentences Whisper's mean CER was
0.24 for ParsVoice A and 0.12 for Audio8, which is why Audio8 stays the fallback.

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
