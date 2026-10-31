import type { BaseLang, Localized, QAAnswer, QAForm, TargetLang } from '@/content/types'
import { levenshtein, matchTargetAnswer, type MatchGrade } from '@/lib/script/match'
import { canonicalize, foldForMatch, foldLatin, isArabicScript } from '@/lib/script/normalize'

/*
 * QA answers may be templates with `{slot}` placeholders for personal information:
 *   ناوم {name}ە.   nawim {name}e.
 * A typed answer matches a template when the fixed parts match and the slot holds any text.
 */

const SLOT_SOURCE = String.raw`\{([a-zA-Z][\w-]*)\}`
// A private-use character survives canonicalization and folding, so the slot position is kept.
const MARK = '\uE001'
const TRAILING_PUNCT = /[\s.,!?;:،؛؟…]+$/u

export const RANK: Record<MatchGrade, number> = { exact: 3, close: 2, typo: 1, wrong: 0 }

export function slotNames(text: string): string[] {
  return [...text.matchAll(new RegExp(SLOT_SOURCE, 'g'))].map((m) => m[1])
}

export function isTemplate(answer: Pick<QAAnswer, 'text' | 'latin'>): boolean {
  return new RegExp(SLOT_SOURCE).test(answer.text) || new RegExp(SLOT_SOURCE).test(answer.latin)
}

export function fillSlots(text: string, value: (slot: string) => string): string {
  return text.replace(new RegExp(SLOT_SOURCE, 'g'), (_, slot: string) => value(slot))
}

/** Splits a template into its fixed parts and the slot names between them. */
export function splitTemplate(text: string): { parts: string[]; slots: string[] } {
  const parts: string[] = []
  const slots: string[] = []
  let last = 0
  for (const m of text.matchAll(new RegExp(SLOT_SOURCE, 'g'))) {
    parts.push(text.slice(last, m.index))
    slots.push(m[1])
    last = m.index! + m[0].length
  }
  parts.push(text.slice(last))
  return { parts, slots }
}

export interface SlotValue {
  text: string
  latin: string
  translation?: Localized
}

export interface FilledAnswer {
  text: string
  latin: string
  translation: Localized
}

/** Fills every slot with the given value (the learner's own, or an example). Missing slots stay as `…`. */
export function fillAnswer(answer: QAAnswer, values: Record<string, SlotValue | undefined>): FilledAnswer {
  const script = (slot: string) => values[slot]?.text || values[slot]?.latin || '…'
  const latin = (slot: string) => values[slot]?.latin || values[slot]?.text || '…'
  const base = (lang: BaseLang) => (slot: string) => values[slot]?.translation?.[lang] || latin(slot)
  return {
    text: fillSlots(answer.text, script),
    latin: fillSlots(answer.latin, latin),
    translation: { en: fillSlots(answer.translation.en, base('en')), sv: fillSlots(answer.translation.sv, base('sv')) },
  }
}

/**
 * Slot values for display: the learner's own when saved, otherwise an example. `variant` picks
 * a different example per template, skipping ones the concrete answers already use.
 */
export function displayValues(
  form: QAForm,
  own: Record<string, SlotValue | undefined>,
  variant = 0,
): Record<string, SlotValue | undefined> {
  const concrete = form.answers.filter((a) => !isTemplate(a)).map((a) => a.text)
  const out: Record<string, SlotValue | undefined> = {}
  for (const [slot, examples] of Object.entries(form.slots ?? {})) {
    const fresh = examples.filter((e) => !concrete.some((t) => t.includes(e.text)))
    const pool = fresh.length ? fresh : examples
    out[slot] = own[slot] ?? pool[variant % pool.length]
  }
  for (const [slot, v] of Object.entries(own)) if (v) out[slot] = v
  return out
}

const wordCount = (s: string) => s.trim().split(/\s+/).length

/**
 * What the learner put in each slot, when their answer matched the template exactly.
 * A suffix slot can swallow a following word (من اهل {place}م matches من اهل مالمو هستم),
 * so a capture longer than any example value is not trusted.
 */
export function captureSlots(
  input: string,
  template: Pick<QAAnswer, 'text' | 'latin'>,
  lang: TargetLang,
  examples?: QAForm['slots'],
): Record<string, SlotValue> | null {
  const trimmed = stripEnd(input.trim())
  if (!trimmed) return null
  const arabic = isArabicScript(trimmed)
  const { parts, slots } = splitTemplate(stripEnd(arabic ? template.text : template.latin))
  const prep = (s: string) => (arabic ? canonicalize(s, lang) : s.normalize('NFC').replace(/\s+/g, ' ').trim())
  const m = new RegExp(`^${prep(parts.join(MARK)).split(MARK).map(escape).join('(.+)')}$`, 'iu').exec(prep(trimmed))
  if (!m) return null
  const out: Record<string, SlotValue> = {}
  for (const [i, slot] of slots.entries()) {
    const value = m[i + 1].trim()
    const maxWords = Math.max(1, ...(examples?.[slot] ?? []).map((e) => wordCount(arabic ? e.text : e.latin)))
    if (!value || wordCount(value) > maxWords) return null
    out[slot] = arabic ? { text: value, latin: '' } : { text: '', latin: value.charAt(0).toUpperCase() + value.slice(1) }
  }
  return out
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function anchoredMatch(input: string, parts: string[]): string[] | null {
  const m = new RegExp(`^${parts.map(escape).join('(.+)')}$`, 'su').exec(input)
  return m ? m.slice(1) : null
}

function typoAllowance(len: number): number {
  if (len >= 9) return 2
  if (len >= 4) return 1
  return 0
}

/** Parts this short are grammatical endings (ە, م, -im): a slip there is a different word, not a typo. */
const MIN_FUZZY_PART = 3

/**
 * One small slip in the fixed words of a one-slot template. The last letter of each fixed part
 * must be right: in Sorani and Persian it is usually a personal or possessive ending.
 */
function fuzzyMatch(input: string, parts: string[]): boolean {
  if (parts.length !== 2) return false
  const [prefix, suffix] = parts.map((p) => [...p])
  const chars = [...input]
  const fixed = prefix.length + suffix.length
  if (fixed < 4) return false

  const best = (part: string[], take: (len: number) => string[]) => {
    let out = { d: Infinity, len: 0 }
    for (const len of [part.length - 1, part.length, part.length + 1]) {
      if (len < 0 || len > chars.length) continue
      const seg = take(len)
      if (part.length && seg.at(-1) !== part.at(-1)) continue
      const d = levenshtein(seg.join(''), part.join(''))
      if (part.length < MIN_FUZZY_PART && d > 0) continue
      if (d < out.d) out = { d, len }
    }
    return out
  }
  const head = best(prefix, (len) => chars.slice(0, len))
  const tail = best(suffix, (len) => chars.slice(chars.length - len))
  if (chars.length - head.len - tail.len < 1) return false
  return head.d + tail.d <= typoAllowance(fixed)
}

const stripEnd = (s: string) => s.replace(TRAILING_PUNCT, '')
const latinNorm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
// foldLatin drops digits, but "20 salim" must still fill the slot with something.
const foldLatinKeepDigits = (s: string) => foldLatin(s.replace(/[0-9۰-۹٠-٩]/g, 'q'))

/** Templates that are only a slot ("{name}.") accept a short answer, not any sentence. */
const MAX_BARE_SLOT_WORDS = 3

/** Grades a typed answer against one template answer. Script or Latin input. */
export function matchTemplate(input: string, template: Pick<QAAnswer, 'text' | 'latin'>, lang: TargetLang): MatchGrade {
  const trimmed = stripEnd(input.trim())
  if (!trimmed) return 'wrong'
  const arabic = isArabicScript(trimmed)
  const source = stripEnd(arabic ? template.text : template.latin)
  const { parts } = splitTemplate(source)
  if (parts.every((p) => !p.trim()) && trimmed.split(/\s+/).length > MAX_BARE_SLOT_WORDS) return 'wrong'
  const marked = parts.join(MARK)

  if (arabic) {
    if (anchoredMatch(canonicalize(trimmed, lang), canonicalize(marked, lang).split(MARK))) return 'exact'
    const folded = foldForMatch(trimmed, lang)
    const foldedParts = foldForMatch(marked, lang).split(MARK)
    if (anchoredMatch(folded, foldedParts)) return 'close'
    return fuzzyMatch(folded, foldedParts) ? 'typo' : 'wrong'
  }

  if (anchoredMatch(latinNorm(trimmed), latinNorm(marked).split(MARK))) return 'exact'
  const folded = foldLatinKeepDigits(trimmed)
  const foldedParts = parts.map(foldLatin)
  if (anchoredMatch(folded, foldedParts)) return 'close'
  return fuzzyMatch(folded, foldedParts) ? 'typo' : 'wrong'
}

export interface AnswerMatch {
  grade: MatchGrade
  /** Index into `answers` of the best match, -1 when wrong. */
  index: number
}

/**
 * Grades a typed answer against every model answer: concrete answers via `matchTargetAnswer`,
 * templates via `matchTemplate`. Final punctuation is optional in both.
 */
export function matchQAAnswer(input: string, answers: QAAnswer[], lang: TargetLang): AnswerMatch {
  const typed = stripEnd(input.trim())
  let best: AnswerMatch = { grade: 'wrong', index: -1 }
  if (!typed) return best
  answers.forEach((answer, index) => {
    const grade = isTemplate(answer)
      ? matchTemplate(typed, answer, lang)
      : matchTargetAnswer(typed, [{ script: stripEnd(answer.text), latin: stripEnd(answer.latin) }], lang).grade
    if (RANK[grade] > RANK[best.grade]) best = { grade, index }
  })
  return best
}

/** Whether two target-language strings are the same answer, ignoring spacing and punctuation. */
export function sameText(a: string, b: string, lang: TargetLang): boolean {
  return foldForMatch(a, lang) === foldForMatch(b, lang)
}
