import type { Form, TargetLang } from '@/content/types'
import type { Candidate } from '@/lib/curriculum'
import { levenshtein, matchTargetAnswer, type MatchResult } from '@/lib/script/match'
import { canonicalize, isArabicScript } from '@/lib/script/normalize'
import { gradeOutcome, Rating, type Grade } from '@/lib/srs'
import { hintSlots, letterCount, stripEndPunctuation, type AnswerScript } from './hints'

export type RecallMode = 'choose' | 'typed' | 'spoken'
/** How the learner prefers to answer once a word is past the options stage. */
export type RecallAnswer = 'type' | 'say'

/** Stability (days) from which a recall card may be reviewed by saying the word aloud. */
export const SPOKEN_MIN_STABILITY = 7
export const SPOKEN_SHARE = 0.3
/** A word is picked among options until it has been recalled this many times. */
export const CHOOSE_UNTIL_REPS = 2

/*
 * Scaffolded like Q&A: a word that just arrived from Recognition is first picked among four
 * options (meaning -> word, the direction speaking needs), then produced from memory.
 * Producing is typed by default, which checks spelling too; learners who prefer to say the
 * word aloud get that instead and grade themselves. Typists still say well-known words aloud
 * now and then, but never on a re-ask after a miss, where an objective check matters most.
 */
export function chooseMode(item: Candidate, attempt: number, random: () => number, prefer: RecallAnswer = 'type'): RecallMode {
  const card = item.card
  if (item.isNew || !card || card.reps < CHOOSE_UNTIL_REPS) return 'choose'
  if (prefer === 'say') return 'spoken'
  if (attempt > 0) return 'typed'
  return card.stability >= SPOKEN_MIN_STABILITY && random() < SPOKEN_SHARE ? 'spoken' : 'typed'
}

/** A mode seed that changes from one review to the next, so the same word doesn't always get the same mode. */
export function modeSeed(item: Candidate, attempt: number): string {
  return `${item.key}:${item.card?.reps ?? 0}:${attempt}`
}

/**
 * `matchTargetAnswer`, ignoring trailing punctuation on both sides
 * (a missing question mark in "how are you?" is not a spelling difference).
 * `expected` is the original accepted form.
 */
export function matchRecall(input: string, forms: Form[], lang: TargetLang): MatchResult {
  const stripped = forms.map((f) => ({ ...f, script: stripEndPunctuation(f.script), latin: stripEndPunctuation(f.latin) }))
  const result = matchTargetAnswer(stripEndPunctuation(input.trim()), stripped, lang)
  const i = stripped.indexOf(result.expected)
  return { ...result, expected: forms[i] ?? forms[0] }
}

export function scriptOf(input: string): AnswerScript {
  return isArabicScript(input) ? 'arabic' : 'latin'
}

/** The two strings to diff: the learner's answer and the expected form, both in the script the learner used. */
export function diffPair(input: string, form: Form, lang: TargetLang): { answer: string; expected: string; script: AnswerScript } {
  const script = scriptOf(input)
  if (script === 'arabic') {
    return {
      answer: stripEndPunctuation(canonicalize(input, lang)),
      expected: stripEndPunctuation(canonicalize(form.script, lang)),
      script,
    }
  }
  const norm = (s: string) => stripEndPunctuation(s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim())
  return { answer: norm(input), expected: norm(form.latin), script }
}

/** The accepted form a wrong answer was closest to, so the diff shows the most useful comparison. */
export function closestForm(input: string, forms: Form[], lang: TargetLang): Form {
  let best = forms[0]
  let bestScore = Infinity
  for (const f of forms) {
    const { answer, expected } = diffPair(input, f, lang)
    const score = levenshtein(answer, expected) / Math.max([...expected].length, 1)
    if (score < bestScore) {
      best = f
      bestScore = score
    }
  }
  return best
}

/** Under this many milliseconds a correct typed answer counts as effortless (Easy); longer words get more time. */
export function fastMsFor(form: Form, script: AnswerScript): number {
  return 3000 + 400 * letterCount(hintSlots(form, script))
}

export interface RecallOutcome {
  match: MatchResult['grade'] | null
  selfGrade?: Grade
  hintsUsed: number
  responseMs: number
  fastMs: number
  attempt: number
  /** The learner said a typed answer judged wrong was right. */
  overridden?: boolean
  /** Picked among options: by schedule (a new word) or as help asked for instead of producing it. */
  chose?: 'scheduled' | 'asked'
}

export function recallGrade(o: RecallOutcome): Grade {
  if (o.chose) {
    // Picking overestimates what the learner can produce: never Easy, and asking for options counts like a hint.
    if (o.match === 'wrong') return Rating.Again
    return o.chose === 'asked' || o.hintsUsed > 0 ? Rating.Hard : Rating.Good
  }
  if (o.overridden) return o.hintsUsed > 0 ? Rating.Hard : Rating.Good
  const g = gradeOutcome({
    match: o.match,
    selfGrade: o.selfGrade,
    hintsUsed: o.hintsUsed,
    attempts: 1,
    responseMs: o.responseMs,
    fastMs: o.fastMs,
  })
  // A re-ask comes minutes after seeing the answer, so a quick success there is short-term memory, not mastery.
  return o.attempt > 0 && g === Rating.Easy ? Rating.Good : g
}
