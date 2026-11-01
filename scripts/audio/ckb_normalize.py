"""Central Kurdish (Sorani) text normalization for the Audio8 Sorani model.

Copied from Audio8-Persian-TTS (https://github.com/ard9/Audio8-Persian-TTS, src/fa_tools.py at commit
48c1dd1), Copyright 2026 Armin Rahimi Darehbagh, licensed under the Apache License, Version 2.0
(see LICENSE-audio8-normalizer in this directory). The model was trained on text normalized exactly
this way. Modifications: only the Sorani normalizer and the shared tables it uses were kept.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_DIACRITICS_RE = re.compile("[ً-ٰٟۖ-ۭ]")
# The repo's clean_text() drops Unicode "C*" characters, which includes ZWNJ
# (U+200C). We remove it explicitly so training and inference always agree.
_INVISIBLE_RE = re.compile("[​-‏‪-‮⁦-⁩﻿]")
_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")


# Central Kurdish (Sorani). Sorani has its own letters (ە ڕ ڵ ۆ ێ ڤ), so the
# upstream Persian rules must not be applied to it.
_CKB_CHAR_MAP = str.maketrans(
    {
        "ي": "ی",
        "ى": "ی",
        "ك": "ک",
        "ة": "ە",
        "ھ": "ه",  # heh doachashmee -> heh, as in the KLPT normalizer
        "«": '"',
        "»": '"',
        "٬": ",",
        "٫": ".",
        "–": "-",
        "—": "-",
    }
)
_CKB_ONES = ["سفر", "یەک", "دوو", "سێ", "چوار", "پێنج", "شەش", "حەوت", "هەشت", "نۆ",
             "دە", "یازدە", "دوازدە", "سێزدە", "چواردە", "پازدە", "شازدە", "حەڤدە", "هەژدە", "نۆزدە"]
_CKB_TENS = ["", "", "بیست", "سی", "چل", "پەنجا", "شەست", "حەفتا", "هەشتا", "نەوەد"]
_CKB_SCALES = [(10**9, "ملیار"), (10**6, "ملیۆن"), (1000, "هەزار")]


def _ckb_below_1000(n: int) -> str:
    parts = []
    hundreds, rest = divmod(n, 100)
    if hundreds:
        parts.append("سەد" if hundreds == 1 else f"{_CKB_ONES[hundreds]} سەد")
    if rest >= 20:
        tens, ones = divmod(rest, 10)
        parts.append(_CKB_TENS[tens] if not ones else f"{_CKB_TENS[tens]} و {_CKB_ONES[ones]}")
    elif rest:
        parts.append(_CKB_ONES[rest])
    return " و ".join(parts)


def ckb_number_words(value: int) -> str:
    """Sorani number words, e.g. 1402 -> هەزار و چوار سەد و دوو."""
    if value == 0:
        return _CKB_ONES[0]
    parts = []
    for scale, name in _CKB_SCALES:
        count, value = divmod(value, scale)
        if count:
            parts.append(name if count == 1 and scale == 1000 else f"{ckb_number_words(count)} {name}")
    if value:
        parts.append(_ckb_below_1000(value))
    return " و ".join(parts)


def _ckb_int(value: str) -> str:
    return ckb_number_words(int(value)) if len(value) <= 12 else " ".join(_CKB_ONES[int(d)] for d in value)


def _ckb_number(match: re.Match[str]) -> str:
    token = match.group()
    if "," in token:
        whole, _, rest = token.partition(",")
        if len(rest) == 3:
            return _ckb_int(whole + rest)
        return f"{_ckb_int(whole)} ، {_ckb_int(rest)}"
    if "." in token:
        whole, _, frac = token.partition(".")
        return f"{_ckb_int(whole)} پۆینت {_ckb_int(frac)}"
    return _ckb_int(token)


def normalize_ckb(text: Any) -> str:
    """Light, deterministic Central Kurdish (Sorani) normalization for TTS input."""
    text = unicodedata.normalize("NFC", str(text or ""))
    text = text.translate(_CKB_CHAR_MAP).translate(_DIGITS)
    text = text.replace("ه\u200c", "ە")  # old typing convention: heh + ZWNJ for the vowel ە
    text = _DIACRITICS_RE.sub("", text)
    text = _INVISIBLE_RE.sub("", text)
    text = text.replace("ـ", "")  # tatweel
    text = re.sub(r"(?<=\d)[,٬](?=\d{3}\b)", "", text)
    text = re.sub(r"(\d+(?:[.,]\d+)?)\s*[%٪]", r" لەسەدا \1 ", text)
    text = _NUMBER_RE.sub(lambda m: f" {_ckb_number(m)} ", text)
    text = re.sub(r"\s+([،,.!?؟:;؛])", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text
