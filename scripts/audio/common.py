"""Shared pieces of the audio pipeline: voices, synthesis engines, post-processing, text folding, manifest."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
import urllib.request
import wave
from dataclasses import dataclass
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PUBLIC = ROOT / "public" / "audio"
TEXTS = HERE / ".texts.json"
VERIFICATION = HERE / "verification.json"
MODELS = Path(os.environ.get("AUDIO_MODELS_DIR", HERE / ".models"))
LANGS = ("ckb", "fa")

VEKOL_REPO = "https://huggingface.co/RevgeAI/vekol-tts-ckb-edge/resolve/main"

VOICES: dict[str, dict] = {
    "fa-audio8": {
        "lang": "fa",
        "engine": "audio8",
        "name": "Audio8 Persian",
        "license": "CC BY-NC 4.0",
        "credit": "Audio8-TTS-Persian by Armin Rahimi Darehbagh (ArminRahimi/Audio8-TTS-Persian), "
        "based on Audio8 TTS by Edge0-AI, trained on Mana-TTS and GPTInformal-Persian",
        "rates": {"*": 0},
    },
    # Fallbacks for clips the Audio8 voice does not get right.
    "fa-dilara": {
        "lang": "fa",
        "engine": "azure",
        "azure": "fa-IR-DilaraNeural",
        "name": "Dilara",
        "license": "Microsoft Azure neural TTS",
        "credit": "Microsoft Azure AI Speech, fa-IR-DilaraNeural",
    },
    "fa-farid": {
        "lang": "fa",
        "engine": "azure",
        "azure": "fa-IR-FaridNeural",
        "name": "Farid",
        "license": "Microsoft Azure neural TTS",
        "credit": "Microsoft Azure AI Speech, fa-IR-FaridNeural",
    },
    "ckb-audio8": {
        "lang": "ckb",
        "engine": "audio8",
        "name": "Audio8 Sorani",
        "license": "CC BY-NC 4.0",
        "credit": "Audio8-TTS-Kurdish-Sorani by Armin Rahimi Darehbagh (ArminRahimi/Audio8-TTS-Kurdish-Sorani), "
        "based on Audio8 TTS by Edge0-AI, trained on central-kurdish-tts4all",
        # Reads isolated words at a natural pace already; the Piper voices need slowing down for them.
        "rates": {"*": 0},
    },
    # Fallback for clips the Audio8 voice does not get right.
    "ckb-berfin": {
        "lang": "ckb",
        "engine": "piper",
        "speaker": 0,
        "name": "Berfin",
        "license": "CC BY-NC 4.0",
        "credit": "Vekol-TTS by Darvan Shvan / Revge (RevgeAI/vekol-tts-ckb-edge)",
    },
    # The model's second, unnamed speaker. Less clear in sentences, so only used where it verifies better.
    "ckb-vekol-2": {
        "lang": "ckb",
        "engine": "piper",
        "speaker": 1,
        "name": "Vekol 2",
        "license": "CC BY-NC 4.0",
        "credit": "Vekol-TTS by Darvan Shvan / Revge (RevgeAI/vekol-tts-ckb-edge)",
    },
}

# Voices tried, in order, when a clip does not verify well (besides a slower rate of the same voice).
ALTERNATE_VOICE = {
    "fa-audio8": "fa-dilara",
    "fa-dilara": "fa-farid",
    "fa-farid": "fa-dilara",
    "ckb-audio8": "ckb-berfin",
    "ckb-berfin": "ckb-vekol-2",
    "ckb-vekol-2": "ckb-berfin",
}

# Which voice reads which kind of text. Questions get a second voice so conversations have two speakers.
DEFAULT_VOICE = {
    "fa": {"*": "fa-audio8"},
    "ckb": {"*": "ckb-audio8"},
}
# Relative speaking rate in percent. Isolated words come out rushed at the engines' default rate.
# A voice can override this with its own "rates".
DEFAULT_RATE = {"word": -10, "*": 0}


@dataclass(frozen=True)
class Render:
    lang: str
    voice: str
    rate: int
    text: str
    # Engines that sample (Audio8) give a different reading per take; 0 is the first one.
    take: int = 0

    @property
    def file(self) -> str:
        key = f"{self.lang}\n{self.voice}\n{self.rate}\n{self.text}" + (f"\n{self.take}" if self.take else "")
        return f"{self.lang}/{hashlib.sha1(key.encode()).hexdigest()[:16]}.mp3"

    @property
    def path(self) -> Path:
        return PUBLIC / self.file


def voice_rate(voice: str, kind: str) -> int:
    rates = VOICES[voice].get("rates", DEFAULT_RATE)
    return rates.get(kind, rates["*"])


def default_render(lang: str, kind: str, text: str) -> Render:
    voices = DEFAULT_VOICE[lang]
    voice = voices.get(kind, voices["*"])
    return Render(lang, voice, voice_rate(voice, kind), text)


def load_texts() -> dict[str, list[dict]]:
    if not TEXTS.exists():
        raise SystemExit(f"{TEXTS.relative_to(ROOT)} is missing; run `npm run audio:collect` first")
    return json.loads(TEXTS.read_text())


def load_verification() -> dict:
    if VERIFICATION.exists():
        data = json.loads(VERIFICATION.read_text())
        data.setdefault("clips", {})
        data.setdefault("choices", {})
        return data
    return {"clips": {}, "choices": {}}


def save_verification(data: dict) -> None:
    # Writes a sorted copy: callers hold references to data["clips"] across saves.
    out = {**data, "clips": dict(sorted(data["clips"].items())), "choices": dict(sorted(data["choices"].items()))}
    VERIFICATION.write_text(json.dumps(out, ensure_ascii=False, indent=0, sort_keys=False) + "\n")


def choice_key(lang: str, text: str) -> str:
    return f"{lang}|{text}"


def planned_render(entry: dict, lang: str, verification: dict) -> Render:
    choice = verification["choices"].get(choice_key(lang, entry["text"]))
    if choice and choice.get("voice") in VOICES:
        return Render(lang, choice["voice"], choice["rate"], entry["text"], choice.get("take", 0))
    return default_render(lang, entry["kind"], entry["text"])


# ---------- text folding (mirrors src/lib/script/normalize.ts) ----------

_BIDI = re.compile("[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]")
_DIACRITICS = re.compile("[\u064b-\u0652\u0655-\u065f\u0670\u06d6-\u06ed]")
_PUNCT = re.compile(r"[.,!?;:،؛؟«»\"'()\[\]{}\-–—…]")
_DIGITS = {**{c: str(i) for i, c in enumerate("٠١٢٣٤٥٦٧٨٩")}, **{c: str(i) for i, c in enumerate("۰۱۲۳۴۵۶۷۸۹")}}
_PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"


def _base(t: str) -> str:
    t = unicodedata.normalize("NFC", t)
    return _BIDI.sub("", t).replace("\u200d", "").replace("\u0640", "")


def _collapse(t: str) -> str:
    t = re.sub("[\u00a0\u2000-\u200b\u202f\u205f\u3000]", " ", t)
    t = re.sub(" *\u200c+ *", "\u200c", t)
    return re.sub(r"\s+", " ", t).strip()


def _persian_digits(t: str) -> str:
    return re.sub("[0-9٠-٩۰-۹]", lambda m: _PERSIAN_DIGITS[int(_DIGITS.get(m[0], m[0]))], t)


def canonicalize(text: str, lang: str) -> str:
    t = _base(text)
    if lang == "fa":
        t = re.sub("\u064bا", "ا\u064b", t).replace("ا\u064b", "ا\ue000")
        t = _DIACRITICS.sub("", t).replace("\ue000", "\u064b")
        t = re.sub("[يى]", "ی", t).replace("ك", "ک").replace("ە", "ه").replace("ھ", "ه").replace("\u0647\u0654", "ۀ")
    else:
        t = re.sub("[یيى]\u065a", "ێ", t).replace("و\u065a", "ۆ").replace("ل\u065a", "ڵ")
        t = re.sub("ر[\u065a\u0655\u0302]", "ڕ", t)
        t = _DIACRITICS.sub("", t)
        t = re.sub("[يى]", "ی", t).replace("ك", "ک").replace("ة", "ە").replace("ھ", "ه").replace("ۀ", "ە")
        t = t.replace("\u0647\u200c", "ە")
        t = re.sub("(^|[\\s(«\"'\\-])ر", "\\1ڕ", t)
    return _collapse(_persian_digits(t))


def fold_for_match(text: str, lang: str) -> str:
    t = canonicalize(text, lang).replace("\u064b", "")
    t = _PUNCT.sub(" ", t)
    t = re.sub("[\\s\u200c]+", "", t)
    t = re.sub("[أإٱ]", "ا", t).replace("ؤ", "و").replace("ۀ", "ه").replace("ء", "")
    t = t.replace("ئ", "ی") if lang == "fa" else t.replace("ە", "ه")
    return "".join(_DIGITS.get(c, c) for c in t)


_NUMBERS = {
    "fa": {
        "ones": "صفر یک دو سه چهار پنج شش هفت هشت نه".split(),
        "teens": "ده یازده دوازده سیزده چهارده پانزده شانزده هفده هجده نوزده".split(),
        "tens": [None, None, *"بیست سی چهل پنجاه شصت هفتاد هشتاد نود".split()],
        "hundreds": [None, *"صد دویست سیصد چهارصد پانصد ششصد هفتصد هشتصد نهصد".split()],
    },
    "ckb": {
        "ones": "سفر یەک دوو سێ چوار پێنج شەش حەوت هەشت نۆ".split(),
        "teens": "دە یازدە دوازدە سێزدە چواردە پازدە شازدە حەڤدە هەژدە نۆزدە".split(),
        "tens": [None, None, *"بیست سی چل پەنجا شەست حەفتا هەشتا نەوەد".split()],
        "hundreds": [None, *"سەد دووسەد سێسەد چوارسەد پێنجسەد شەشسەد حەوتسەد هەشتسەد نۆسەد".split()],
    },
}


def _number_words(n: int, lang: str) -> str:
    w = _NUMBERS[lang]
    if n < 10:
        return w["ones"][n]
    if n < 20:
        return w["teens"][n - 10]
    if n < 100:
        rest = n % 10
        return w["tens"][n // 10] + (f" و {w['ones'][rest]}" if rest else "")
    if n < 1000:
        rest = n % 100
        return w["hundreds"][n // 100] + (f" و {_number_words(rest, lang)}" if rest else "")
    return str(n)


def spell_numbers(text: str, lang: str) -> str:
    t = "".join(_DIGITS.get(c, c) for c in text)
    return re.sub(r"\d+", lambda m: _number_words(int(m[0]), lang), t)


def levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(reference: str, hypothesis: str, lang: str) -> float:
    ref = fold_for_match(reference, lang)
    if not ref:
        return 0.0
    best = 1e9
    for hyp in {hypothesis, spell_numbers(hypothesis, lang)}:
        best = min(best, levenshtein(ref, fold_for_match(hyp, lang)) / len(ref))
    return min(best, 1.0)


# ---------- synthesis ----------

_PIPER_PUNCT = str.maketrans({"?": "؟", ",": "،", ";": "؛", "…": ".", "«": '"', "»": '"', "“": '"', "”": '"', "\u200c": ""})


def piper_text(text: str, symbols: set[str]) -> str:
    t = canonicalize(text, "ckb").translate(_PIPER_PUNCT)
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if c in symbols or c.isspace())
    t = re.sub(r"\s+", " ", t).strip()
    if t and t[-1] not in ".!؟":
        t += "."
    return unicodedata.normalize("NFC", t)


class PiperEngine:
    def __init__(self) -> None:
        from piper import PiperVoice

        model = ensure_vekol()
        self.voice = PiperVoice.load(model)
        self.symbols = set(self.voice.config.phoneme_id_map)

    def synth(self, text: str, speaker: int, rate: int, out_wav: Path) -> None:
        from piper import SynthesisConfig

        cfg = SynthesisConfig(speaker_id=speaker, length_scale=1 / (1 + rate / 100))
        with wave.open(str(out_wav), "wb") as w:
            self.voice.synthesize_wav(piper_text(text, self.symbols), w, syn_config=cfg)


def ensure_vekol() -> Path:
    MODELS.mkdir(parents=True, exist_ok=True)
    target = MODELS / "vekol.onnx"
    for name, dest in (("model.onnx", target), ("model.onnx.json", MODELS / "vekol.onnx.json")):
        if dest.exists():
            continue
        local = Path("/tmp/tts") / dest.name
        if local.exists():
            shutil.copy(local, dest)
            continue
        print(f"downloading {name} from {VEKOL_REPO}")
        urllib.request.urlretrieve(f"{VEKOL_REPO}/{name}", dest)
    return target


def azure_configured() -> bool:
    return bool(os.environ.get("AZURE_SPEECH_KEY") and os.environ.get("AZURE_SPEECH_REGION"))


def _rate(rate: int) -> str:
    return f"{rate:+d}%"


def _azure_synth(text: str, voice: str, rate: int) -> bytes:
    region = os.environ["AZURE_SPEECH_REGION"]
    ssml = (
        f"<speak version='1.0' xml:lang='fa-IR'><voice name='{voice}'>"
        f"<prosody rate='{_rate(rate)}'>{escape(text)}</prosody></voice></speak>"
    )
    req = urllib.request.Request(
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
        data=ssml.encode(),
        headers={
            "Ocp-Apim-Subscription-Key": os.environ["AZURE_SPEECH_KEY"],
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
            "User-Agent": "ziman-zaban-audio",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


async def _edge_synth(text: str, voice: str, rate: int) -> bytes:
    import edge_tts

    chunks = []
    async for msg in edge_tts.Communicate(text, voice, rate=_rate(rate)).stream():
        if msg["type"] == "audio":
            chunks.append(msg["data"])
    if not chunks:
        raise RuntimeError("no audio received")
    return b"".join(chunks)


async def microsoft_synth(text: str, voice: str, rate: int) -> tuple[bytes, str]:
    """Returns (audio bytes, file suffix). Uses the Azure Speech API when configured, else Edge read-aloud."""
    last: Exception | None = None
    for attempt in range(5):
        try:
            if azure_configured():
                return await asyncio.to_thread(_azure_synth, text, voice, rate), ".wav"
            return await _edge_synth(text, voice, rate), ".mp3"
        except Exception as e:  # network hiccups and throttling
            last = e
            await asyncio.sleep(2**attempt)
    raise RuntimeError(f"synthesis failed for {text!r}: {last}")


# ---------- post-processing ----------

TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02"
EDGE_PAD = "adelay=80:all=1,apad=pad_dur=0.08"
SAMPLE_RATE = 24000
BITRATE = os.environ.get("AUDIO_BITRATE", "48k")


def _measure_loudness(src: Path, pre: str) -> dict | None:
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af", f"{pre},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr)
    if not m:
        return None
    data = json.loads(m[0])
    try:
        if float(data["input_i"]) == float("-inf") or float(data["input_i"]) < -70:
            return None
    except ValueError:
        return None
    return data


def postprocess(src: Path, dest: Path) -> float:
    """Trims silence to ~80 ms, normalizes loudness to -16 LUFS and encodes mono MP3. Returns duration in seconds."""
    pre = f"aformat=channel_layouts=mono,{TRIM},areverse,{TRIM},areverse"
    m = _measure_loudness(src, pre)
    if m:
        norm = (
            f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
            f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
        )
    else:
        norm = "loudnorm=I=-16:TP=-1.5:LRA=11"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp.mp3")
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-af", f"{pre},{norm},{EDGE_PAD}",
         "-ar", str(SAMPLE_RATE), "-ac", "1", "-c:a", "libmp3lame", "-b:a", BITRATE, "-map_metadata", "-1", "-write_xing", "1", str(tmp)],
        check=True,
    )
    tmp.replace(dest)
    return duration(dest)


def duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def tmpdir() -> Path:
    return Path(tempfile.mkdtemp(prefix="zz-audio-"))


# ---------- rendering ----------


def write_wav(path: Path, audio, sample_rate: int, rate: int = 0) -> None:
    """Writes float audio as 16-bit WAV; a nonzero `rate` (percent) time-stretches it without changing pitch."""
    import numpy as np

    pcm = (np.clip(np.asarray(audio, dtype=np.float32), -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm.tobytes())
    if rate:
        stretched = path.with_suffix(".stretch.wav")
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path), "-af", f"atempo={1 + rate / 100:.3f}", str(stretched)],
            check=True,
        )
        stretched.replace(path)


class Renderer:
    """Renders `Render`s to public/audio, loading the Sorani models only when needed."""

    AUDIO8_BATCH = 8

    def __init__(self) -> None:
        self._piper: PiperEngine | None = None
        self._audio8: dict = {}
        self.work = tmpdir()

    @property
    def piper(self) -> PiperEngine:
        if self._piper is None:
            self._piper = PiperEngine()
        return self._piper

    def audio8(self, lang: str):
        if lang not in self._audio8:
            from audio8 import Audio8Engine

            self._audio8.clear()  # one 0.6B model in memory at a time
            self._audio8[lang] = Audio8Engine(MODELS, lang)
        return self._audio8[lang]

    def close(self) -> None:
        shutil.rmtree(self.work, ignore_errors=True)
        self._piper = None
        self._audio8 = {}

    def render_audio8(self, items: list[Render], on_done=None) -> None:
        """Batches clips of similar length; each finished clip is on disk at once, so an interrupted run resumes."""
        import time
        from concurrent.futures import ThreadPoolExecutor

        groups: dict[tuple[str, int], list[Render]] = {}
        for r in items:
            groups.setdefault((r.lang, r.take), []).append(r)
        start, batches = time.time(), 0
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = []
            for (lang, take), group in sorted(groups.items()):
                engine = self.audio8(lang)
                group.sort(key=lambda r: len(r.text))
                for i in range(0, len(group), self.AUDIO8_BATCH):
                    chunk = group[i : i + self.AUDIO8_BATCH]
                    wavs = engine.synth_batch([r.text for r in chunk], take)
                    batches += 1
                    if batches % 10 == 0:
                        e = engine
                        print(
                            f"  audio8 {lang}: {e.clips} clips, {(time.time() - start) / e.clips:.1f} s/clip,"
                            f" {e.resampled} re-sampled, {e.implausible} kept despite odd length",
                            flush=True,
                        )
                    for r, audio in zip(chunk, wavs):
                        if not len(audio):
                            print(f"  audio8 produced nothing for {r.text!r}", flush=True)
                            continue
                        raw = self.work / (r.file.replace("/", "_") + ".wav")
                        write_wav(raw, audio, engine.sample_rate, r.rate)

                        def finish(raw=raw, r=r):
                            postprocess(raw, r.path)
                            raw.unlink(missing_ok=True)
                            if on_done:
                                on_done(r)

                        futures.append(pool.submit(finish))
            for f in futures:
                f.result()

    async def render_microsoft(self, items: list[Render], concurrency: int = 6, on_done=None) -> None:
        sem = asyncio.Semaphore(concurrency)

        async def one(r: Render) -> None:
            async with sem:
                data, suffix = await microsoft_synth(r.text, VOICES[r.voice]["azure"], r.rate)
                raw = self.work / (r.file.replace("/", "_") + suffix)
                raw.write_bytes(data)
                await asyncio.to_thread(postprocess, raw, r.path)
                raw.unlink(missing_ok=True)
                if on_done:
                    on_done(r)

        await asyncio.gather(*(one(r) for r in items))

    def render_piper(self, items: list[Render], on_done=None) -> None:
        from concurrent.futures import ThreadPoolExecutor

        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = []
            for r in items:
                raw = self.work / (r.file.replace("/", "_") + ".wav")
                self.piper.synth(r.text, VOICES[r.voice]["speaker"], r.rate, raw)

                def finish(raw=raw, r=r):
                    postprocess(raw, r.path)
                    raw.unlink(missing_ok=True)
                    if on_done:
                        on_done(r)

                futures.append(pool.submit(finish))
            for f in futures:
                f.result()

    def render(self, items: list[Render], on_done=None) -> None:
        ms = [r for r in items if VOICES[r.voice]["engine"] == "azure"]
        local = [r for r in items if VOICES[r.voice]["engine"] == "piper"]
        audio8 = [r for r in items if VOICES[r.voice]["engine"] == "audio8"]
        if audio8:
            self.render_audio8(audio8, on_done)
        if local:
            self.render_piper(local, on_done)
        if ms:
            asyncio.run(self.render_microsoft(ms, on_done=on_done))


# ---------- manifest ----------


def write_manifest(texts: dict[str, list[dict]], verification: dict) -> dict:
    manifest: dict = {}
    used_voices: set[str] = set()
    for lang in LANGS:
        out = {}
        for entry in texts.get(lang, []):
            r = planned_render(entry, lang, verification)
            if not r.path.exists():
                continue
            clip = {"f": r.file, "v": r.voice}
            q = verification["clips"].get(r.file, {}).get("cer")
            if q is not None:
                clip["q"] = round(q, 2)
            out[entry["text"]] = clip
            used_voices.add(r.voice)
        manifest[lang] = out
    manifest["voices"] = {
        v: {k: VOICES[v][k] for k in ("name", "engine", "license", "credit")} for v in sorted(used_voices)
    }
    for v in manifest["voices"].values():
        if v["engine"] == "azure":
            v["engine"] = "Microsoft neural TTS"
        elif v["engine"] == "piper":
            v["engine"] = "Piper VITS"
        elif v["engine"] == "audio8":
            v["engine"] = "Audio8 TTS (DualAR)"
    PUBLIC.mkdir(parents=True, exist_ok=True)
    (PUBLIC / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n")
    return manifest


def referenced_files(texts: dict[str, list[dict]], verification: dict) -> set[str]:
    return {planned_render(e, lang, verification).file for lang in LANGS for e in texts.get(lang, [])}


def prune(texts: dict[str, list[dict]], verification: dict) -> int:
    """Deletes clips no text uses any more (old voices, losing retries, removed content)."""
    keep = referenced_files(texts, verification)
    removed = 0
    for lang in LANGS:
        for f in (PUBLIC / lang).glob("*.mp3"):
            if f"{lang}/{f.name}" not in keep:
                f.unlink()
                removed += 1
    clips = verification["clips"]
    for f in [f for f in clips if f not in keep]:
        del clips[f]
    return removed
