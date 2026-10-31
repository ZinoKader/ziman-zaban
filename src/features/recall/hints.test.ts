import { describe, expect, it } from 'vitest'
import type { Form } from '@/content/types'
import { hintSlots, hintView, letterCount, maxHintLevel, stripEndPunctuation } from './hints'

const supas: Form = { script: 'سوپاس', latin: 'supas' }
const goodbye: Form = { script: 'خوات لەگەڵ', latin: 'xwat legeł' }
const howAreYou: Form = { script: 'چۆنی؟', latin: 'çonî?' }

describe('hints', () => {
  it('strips trailing punctuation', () => {
    expect(stripEndPunctuation('çonî?')).toBe('çonî')
    expect(stripEndPunctuation('چۆنی؟')).toBe('چۆنی')
    expect(stripEndPunctuation('hâl-e shomâ')).toBe('hâl-e shomâ')
  })

  it('counts letters in the script the learner answers in', () => {
    expect(letterCount(hintSlots(supas, 'arabic'))).toBe(5)
    expect(letterCount(hintSlots(supas, 'latin'))).toBe(5)
    expect(letterCount(hintSlots(howAreYou, 'arabic'))).toBe(4)
    expect(letterCount(hintSlots(howAreYou, 'latin'))).toBe(4)
  })

  it('keeps word gaps', () => {
    const slots = hintSlots(goodbye, 'latin')
    expect(slots.map((s) => (s.kind === 'gap' ? ' ' : s.text)).join('')).toBe('xwat legeł')
    expect(letterCount(slots)).toBe(9)
  })

  it('treats a half space as a word gap', () => {
    const slots = hintSlots({ script: 'بچه‌ها', latin: 'bachche-hâ' }, 'arabic')
    expect(slots.filter((s) => s.kind === 'gap')).toHaveLength(1)
    expect(letterCount(slots)).toBe(5)
  })

  it('reveals the first letter, then one more per level, never the whole word', () => {
    expect(hintView(supas, 'latin', 0).shown).toBe(0)
    const one = hintView(supas, 'latin', 1)
    expect(one.shown).toBe(1)
    expect(one.total).toBe(5)
    expect(one.slots.filter((s) => s.kind === 'letter' && s.revealed).map((s) => s.kind === 'letter' && s.text)).toEqual(['s'])
    expect(hintView(supas, 'arabic', 2).slots.filter((s) => 'revealed' in s && s.revealed)).toHaveLength(2)
    expect(hintView(supas, 'latin', 99).shown).toBe(4)
    expect(maxHintLevel(hintSlots(supas, 'latin'))).toBe(4)
  })

  it('reveals the first Arabic letter in reading order', () => {
    const v = hintView(supas, 'arabic', 1)
    expect(v.slots[0]).toEqual({ kind: 'letter', text: 'س', revealed: true })
  })
})
