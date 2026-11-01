"""Persian text normalization for the Audio8 Persian model.

Copied from Audio8-Persian-TTS (https://github.com/ard9/Audio8-Persian-TTS, src/fa_tools.py at commit
48c1dd1), Copyright 2026 Armin Rahimi Darehbagh, licensed under the Apache License, Version 2.0
(see LICENSE-audio8-normalizer in this directory). The model was trained on text normalized exactly
this way. Modifications: only the Persian normalizer and the tables it uses were kept.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

_CHAR_MAP = str.maketrans(
    {
        "ي": "ی",
        "ى": "ی",
        "ك": "ک",
        "ة": "ه",
        "أ": "ا",
        "إ": "ا",
        "ٱ": "ا",
        "«": '"',
        "»": '"',
        "٬": ",",
        "٫": ".",
        "–": "-",
        "—": "-",
    }
)
_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_DIACRITICS_RE = re.compile("[ً-ٰٟۖ-ۭ]")
# The repo's clean_text() drops Unicode "C*" characters, which includes ZWNJ
# (U+200C). We remove it explicitly so training and inference always agree.
_INVISIBLE_RE = re.compile("[​-‏‪-‮⁦-⁩﻿]")
_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")


def _int_to_words(value: str) -> str:
    try:
        from num2fawords import words
    except ImportError:  # keep digits if the package is missing
        return value
    text = words(int(value))
    if text.startswith("یک هزار"):
        text = text[len("یک ") :]
    return text


def _number_to_words(match: re.Match[str]) -> str:
    token = match.group()
    if "," in token:
        whole, _, rest = token.partition(",")
        if len(rest) == 3:  # thousands separator: 1,234
            return _int_to_words(whole + rest)
        return f"{_int_to_words(whole)} ، {_int_to_words(rest)}"
    if "." in token:
        whole, _, frac = token.partition(".")
        return f"{_int_to_words(whole)} ممیز {_int_to_words(frac)}"
    return _int_to_words(token)


def normalize_fa(text: Any) -> str:
    """Light, deterministic Persian normalization for TTS input."""
    text = unicodedata.normalize("NFC", str(text or ""))
    text = text.translate(_CHAR_MAP).translate(_DIGITS)
    text = _DIACRITICS_RE.sub("", text)
    text = _INVISIBLE_RE.sub("", text)
    text = text.replace("ـ", "")  # tatweel
    text = re.sub(r"(?<=\d)[,٬](?=\d{3}\b)", "", text)
    text = text.replace("%", " درصد ").replace("٪", " درصد ")
    text = _NUMBER_RE.sub(lambda m: f" {_number_to_words(m)} ", text)
    text = re.sub(r"\s+([،,.!?؟:;؛])", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text
