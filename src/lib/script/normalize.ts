import type { TargetLang } from '@/content/types'

export const ZWNJ = '\u200C'

const TATWEEL = /\u0640/g
// Arabic harakat, superscript alef and Quranic marks. Neither Sorani nor everyday Persian needs them.
const DIACRITICS = /[\u064B-\u0652\u0655-\u065F\u0670\u06D6-\u06ED]/g
const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g
const ZW_JOINERS = /\u200D/g

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function mapDigits(text: string, to: 'persian' | 'ascii'): string {
  return text.replace(/[0-9٠-٩۰-۹]/g, (d) => {
    let n = ARABIC_INDIC_DIGITS.indexOf(d)
    if (n < 0) n = PERSIAN_DIGITS.indexOf(d)
    if (n < 0) n = Number(d)
    return to === 'persian' ? PERSIAN_DIGITS[n] : String(n)
  })
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/ *\u200C+ */g, ZWNJ)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Puts Persian text into standard Iranian orthography: Persian yeh and keheh,
 * no stray Kurdish letters, Persian digits. Only applies transformations that
 * cannot change the intended word.
 */
export function canonicalizePersian(input: string): string {
  let t = input.normalize('NFC')
  t = t.replace(BIDI_CONTROLS, '').replace(ZW_JOINERS, '').replace(TATWEEL, '')
  // Tanwin on alef is standard Persian spelling (لطفاً، حتماً); other harakat are dropped.
  t = t.replace(/\u064Bا/g, 'ا\u064B').replace(/ا\u064B/g, 'ا\uE000')
  t = t.replace(DIACRITICS, '').replace(/\uE000/g, '\u064B')
  t = t
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ە/g, 'ه')
    .replace(/ھ/g, 'ه')
    .replace(/\u0647\u0654/g, 'ۀ')
  t = mapDigits(t, 'persian')
  return collapseWhitespace(t)
}

/**
 * Puts Sorani text into the standard Central Kurdish Unicode orthography
 * (as used by AsoSoft and the Kurdish Unified Keyboard):
 *  - vowel /e/ is ە (U+06D5), consonant /h/ is ه (U+0647)
 *  - ێ ۆ ڵ ڕ are the precomposed letters
 *  - word-initial r is always ڕ
 *  - Arabic yeh/kaf/teh marbuta, common in legacy text, become ی ک ە
 */
export function canonicalizeSorani(input: string, options: { legacy?: boolean } = {}): string {
  let t = input.normalize('NFC')
  t = t.replace(BIDI_CONTROLS, '').replace(ZW_JOINERS, '').replace(TATWEEL, '')
  t = t
    .replace(/[یيى]\u065A/g, 'ێ')
    .replace(/و\u065A/g, 'ۆ')
    .replace(/ل\u065A/g, 'ڵ')
    .replace(/ر[\u065A\u0655\u0302]/g, 'ڕ')
  t = t.replace(DIACRITICS, '')
  t = t
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ە')
    .replace(/ھ/g, 'ه')
    .replace(/ۀ/g, 'ە')
    .replace(/\u0647\u200C/g, 'ە')
  // Legacy encodings write the vowel ە as ه. Word-final ه after a letter is then almost always
  // the vowel, but real words like گوناه end in /h/, so this only runs on known-legacy input.
  if (options.legacy) {
    t = t.replace(/([\u0621-\u06FF])ه(?=$|[\s.,!?؟،؛:)»"'\-])/g, '$1ە')
  }
  t = t.replace(/(^|[\s(«"'\-])ر/g, '$1ڕ')
  t = mapDigits(t, 'persian')
  return collapseWhitespace(t)
}

export function canonicalize(text: string, lang: TargetLang): string {
  return lang === 'fa' ? canonicalizePersian(text) : canonicalizeSorani(text)
}

const PUNCTUATION = /[.,!?;:،؛؟«»"'()[\]{}\-–—…]/g

/**
 * Aggressive folding used only to decide whether a learner's answer matches.
 * Spacing, ZWNJ, punctuation and hamza/alef variants are ignored.
 */
export function foldForMatch(text: string, lang: TargetLang): string {
  let t = canonicalize(text, lang).replace(/\u064B/g, '')
  t = t.replace(PUNCTUATION, ' ')
  t = t.replace(/[\s\u200C]+/g, '')
  t = t.replace(/[أإٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ۀ/g, 'ه').replace(/ء/g, '')
  if (lang === 'fa') {
    t = t.replace(/ئ/g, 'ی')
  } else {
    // Many Sorani writers drop the hamza seat or mix up h/e at word edges.
    t = t.replace(/ە/g, 'ه')
  }
  return mapDigits(t, 'ascii')
}

const LATIN_FOLD: Array<[RegExp, string]> = [
  [/ş|š|sh/g, 'S'],
  [/ç|č|ch/g, 'C'],
  [/ž|zh/g, 'Z'],
  [/ẍ|ğ|gh/g, 'G'],
  [/x|kh/g, 'X'],
  [/ḧ|ḥ/g, 'h'],
  [/ř|rr/g, 'r'],
  [/ł|ll/g, 'l'],
  [/â|ā|aa/g, 'a'],
  [/ê|ē/g, 'e'],
  [/î|ī|ee/g, 'i'],
  [/û|ū|oo|uu/g, 'u'],
  [/['ʼʻ`’‘´]/g, ''],
]

/** Folds any common romanization of Sorani or Persian to a comparable skeleton. */
export function foldLatin(text: string): string {
  let t = text.normalize('NFC').toLowerCase()
  for (const [re, rep] of LATIN_FOLD) t = t.replace(re, rep)
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return t.replace(/[^a-zA-Z]/g, '')
}

const LOOSE_FOLD: Array<[RegExp, string]> = [
  [/e/g, 'a'],
  [/o/g, 'u'],
  [/y/g, 'i'],
  [/[cZ]/g, 'j'],
  [/q/g, 'G'],
  [/v/g, 'w'],
  [/(.)\1+/g, '$1'],
]

/**
 * `foldLatin`, plus the distinctions a learner typing on an English or Swedish keyboard
 * shouldn't be marked down for: vowel quality (a/e, o/u, i/y), c/j/zh, q/gh, v/w,
 * doubled letters and a silent word-final h ("khaneh").
 */
export function foldLatinLoose(text: string): string {
  let t = text.normalize('NFC').toLowerCase().replace(/ı/g, 'i')
  t = t.replace(/([aeiouâêîôûāēīōū])h(?=[^a-z]|$)/g, '$1')
  t = foldLatin(t)
  for (const [re, rep] of LOOSE_FOLD) t = t.replace(re, rep)
  return t
}

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/

export function isArabicScript(text: string): boolean {
  return ARABIC_SCRIPT.test(text)
}
