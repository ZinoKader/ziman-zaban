import type { Form, TargetLang } from '@/content/types'
import { canonicalize, foldForMatch, foldLatin, isArabicScript } from './normalize'

export type MatchGrade =
  /** Exactly the expected spelling. */
  | 'exact'
  /** Same word; differs only in spacing/ZWNJ, hamza or similar spelling details. */
  | 'close'
  /** One small slip (a single wrong, missing or extra letter) in a longer word. */
  | 'typo'
  | 'wrong'

export interface MatchResult {
  grade: MatchGrade
  /** The accepted form the answer was matched against (or the primary one when wrong). */
  expected: Form
  /** Whether the learner answered in Arabic script or Latin letters. */
  inputScript: 'arabic' | 'latin'
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const A = [...a]
  const B = [...b]
  if (!A.length) return B.length
  if (!B.length) return A.length
  let prev = Array.from({ length: B.length + 1 }, (_, i) => i)
  for (let i = 1; i <= A.length; i++) {
    const cur = [i]
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[B.length]
}

/** Typos are only forgiven in words long enough that one slip doesn't make another word. */
function typoAllowance(len: number): number {
  if (len >= 9) return 2
  if (len >= 4) return 1
  return 0
}

/**
 * Grades a typed answer in a target language against all accepted forms.
 * Accepts Arabic script or Latin romanization.
 */
export function matchTargetAnswer(input: string, accepted: Form[], lang: TargetLang): MatchResult {
  const primary = accepted[0]
  const trimmed = input.trim()
  const inputScript = isArabicScript(trimmed) ? 'arabic' : 'latin'
  if (!trimmed) return { grade: 'wrong', expected: primary, inputScript }

  let best: MatchResult = { grade: 'wrong', expected: primary, inputScript }
  const rank: Record<MatchGrade, number> = { exact: 3, close: 2, typo: 1, wrong: 0 }

  for (const form of accepted) {
    let grade: MatchGrade = 'wrong'
    if (inputScript === 'arabic') {
      if (canonicalize(trimmed, lang) === canonicalize(form.script, lang)) grade = 'exact'
      else {
        const a = foldForMatch(trimmed, lang)
        const b = foldForMatch(form.script, lang)
        if (a === b) grade = 'close'
        else if (levenshtein(a, b) <= typoAllowance([...b].length)) grade = 'typo'
      }
    } else {
      const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
      if (norm(trimmed) === norm(form.latin)) grade = 'exact'
      else {
        const a = foldLatin(trimmed)
        const b = foldLatin(form.latin)
        if (a === b) grade = 'close'
        else if (levenshtein(a, b) <= typoAllowance(b.length)) grade = 'typo'
      }
    }
    if (rank[grade] > rank[best.grade]) best = { grade, expected: form, inputScript }
    if (grade === 'exact') break
  }
  return best
}

function foldBase(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .trim()
    .replace(/^(to|att|a|an|the|en|ett)\s+/, '')
    .replace(/[.,!?;:"'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Grades a typed meaning in English or Swedish. Leading "to"/"att" and articles are optional,
 * parenthesised parts of the gloss are optional.
 */
export function matchBaseAnswer(input: string, accepted: string[]): { grade: MatchGrade; expected: string } {
  const a = foldBase(input)
  let best: { grade: MatchGrade; expected: string } = { grade: 'wrong', expected: accepted[0] }
  if (!a) return best
  for (const option of accepted.flatMap((o) => o.split(/\s*[/;]\s*/))) {
    const b = foldBase(option)
    if (!b) continue
    if (a === b) return { grade: 'exact', expected: option }
    if (best.grade === 'wrong' && levenshtein(a, b) <= typoAllowance(b.length)) {
      best = { grade: 'typo', expected: option }
    }
  }
  return best
}
