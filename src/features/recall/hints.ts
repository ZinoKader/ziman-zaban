import type { Form } from '@/content/types'
import { ZWNJ } from '@/lib/script/normalize'

export type AnswerScript = 'arabic' | 'latin'

const END_PUNCTUATION = /[\s.!?؟،,;؛:…]+$/u
const SEPARATOR = /^[\s\u200C\-‐–]$/u
const MARK = /^\p{M}$/u
const SKIPPED = /^[.!?؟،,;؛:…"'«»()]$/u

/** Removes trailing punctuation, which is never part of what the learner has to recall. */
export function stripEndPunctuation(text: string): string {
  return text.replace(END_PUNCTUATION, '')
}

/** One slot in the hint mask: a letter (combining marks kept with their base) or a word gap. */
export type HintSlot = { kind: 'letter'; text: string } | { kind: 'gap' }

/** Splits a form into letters and word gaps, in reading order. */
export function hintSlots(form: Form, script: AnswerScript): HintSlot[] {
  const raw = stripEndPunctuation(script === 'arabic' ? form.script : form.latin.toLowerCase()).normalize('NFC')
  const slots: HintSlot[] = []
  for (const ch of raw) {
    if (SEPARATOR.test(ch) || ch === ZWNJ) {
      if (slots.length && slots[slots.length - 1].kind !== 'gap') slots.push({ kind: 'gap' })
    } else if (MARK.test(ch)) {
      const last = slots[slots.length - 1]
      if (last?.kind === 'letter') last.text += ch
    } else if (!SKIPPED.test(ch)) {
      slots.push({ kind: 'letter', text: ch })
    }
  }
  while (slots.length && slots[slots.length - 1].kind === 'gap') slots.pop()
  return slots
}

export function letterCount(slots: HintSlot[]): number {
  return slots.filter((s) => s.kind === 'letter').length
}

/** How many hint presses are useful: never give away the whole word. */
export function maxHintLevel(slots: HintSlot[]): number {
  return Math.max(1, letterCount(slots) - 1)
}

export interface HintView {
  /** Slots with `revealed` set on the letters shown so far. */
  slots: Array<HintSlot & { revealed?: boolean }>
  shown: number
  total: number
}

/**
 * Level 1 shows the first letter and the letter count, every further level one more letter,
 * up to all but the last letter.
 */
export function hintView(form: Form, script: AnswerScript, level: number): HintView {
  const slots = hintSlots(form, script)
  const total = letterCount(slots)
  const shown = Math.max(0, Math.min(level, total - 1))
  let n = 0
  return {
    slots: slots.map((s) => (s.kind === 'letter' ? { ...s, revealed: n++ < shown } : s)),
    shown,
    total,
  }
}
