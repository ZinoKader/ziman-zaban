import { describe, expect, it } from 'vitest'
import { qaFor } from '@/content'
import type { TargetLang } from '@/content/types'
import { seededRandom } from '@/lib/distractors'
import { newCard, Rating, type StoredCard } from '@/lib/srs'
import { buildChoiceOptions, buildTiles, checkTiles, chooseMode, finalGrade } from './options'
import { matchQAAnswer, sameText } from './template'

const card = (patch: Partial<StoredCard>): StoredCard => ({ ...newCard(new Date()), ...patch })

describe.each(['ckb', 'fa'] as TargetLang[])('choice options (%s)', (lang) => {
  const pool = qaFor(lang)

  it('has content to test with', () => {
    expect(pool.length).toBeGreaterThan(4)
  })

  it('gives exactly one fitting answer among four distinct options', () => {
    for (const item of pool) {
      const form = item[lang]!
      const options = buildChoiceOptions(item, lang, pool, seededRandom(item.id))
      expect(options).toHaveLength(4)
      expect(options.filter((o) => o.correct)).toHaveLength(1)
      const right = options.find((o) => o.correct)!
      expect(form.answers.some((a) => a.text === right.text)).toBe(true)
      expect(right.text).not.toContain('{')
      for (const o of options.filter((x) => !x.correct)) {
        expect(o.text).not.toContain('{')
        expect(matchQAAnswer(o.text, form.answers, lang).grade).toBe('wrong')
      }
      const texts = options.map((o) => o.text)
      expect(new Set(texts).size).toBe(4)
      expect(texts.some((a, i) => texts.some((b, j) => i !== j && sameText(a, b, lang)))).toBe(false)
    }
  })

  it('is deterministic for a seed and prefers the same unit', () => {
    const item = pool[0]
    const a = buildChoiceOptions(item, lang, pool, seededRandom('seed'))
    const b = buildChoiceOptions(item, lang, pool, seededRandom('seed'))
    expect(a).toEqual(b)
    const sameUnit = pool.filter((q) => q.unit === item.unit && q.id !== item.id).map((q) => q.id)
    for (const o of a.filter((x) => !x.correct)) expect(sameUnit).toContain(o.id.split('#')[0])
  })

  it('builds tiles from the model answer plus extras from other answers', () => {
    for (const item of pool) {
      const form = item[lang]!
      if (!form.answers[0].tokens?.length) continue
      const { answer, bank } = buildTiles(item, lang, pool, seededRandom(item.id))
      expect(answer).toHaveLength(form.answers[0].tokens.length)
      expect(bank.length).toBe(answer.length + 3)
      for (const t of answer) expect(bank).toContainEqual(t)
      for (const t of bank) expect(t.text).not.toMatch(/[.،؟?!]$/)
      expect(checkTiles(answer, form, lang)).toEqual({ grade: 'exact', index: 0 })
      if (answer.length > 1) expect(checkTiles([...answer].reverse(), form, lang).grade).toBe('wrong')
      const extras = bank.filter((t) => !answer.includes(t))
      expect(checkTiles([...answer, extras[0]], form, lang).grade).toBe('wrong')
    }
  })
})

describe('chooseMode', () => {
  const form = qaFor('ckb')[0].ckb!

  it('scaffolds from choosing to building to answering freely', () => {
    expect(chooseMode({ isNew: true }, form, 0)).toBe('choose')
    expect(chooseMode({ isNew: false, card: card({ reps: 1, stability: 1 }) }, form, 0)).toBe('choose')
    expect(chooseMode({ isNew: false, card: card({ reps: 3, stability: 2 }) }, form, 0)).toBe('build')
    expect(chooseMode({ isNew: false, card: card({ reps: 5, stability: 12 }) }, form, 0)).toBe('free')
  })

  it('steps down a level when the item comes back after a miss', () => {
    expect(chooseMode({ isNew: false, card: card({ reps: 5, stability: 12 }) }, form, 1)).toBe('build')
    expect(chooseMode({ isNew: false, card: card({ reps: 3, stability: 2 }) }, form, 1)).toBe('choose')
  })

  it('does not build when the model answer has no tiles', () => {
    const bare = { ...form, answers: [{ ...form.answers[0], tokens: undefined }] }
    expect(chooseMode({ isNew: false, card: card({ reps: 3, stability: 2 }) }, bare, 0)).toBe('choose')
  })
})

describe('finalGrade', () => {
  const base = { hintUsed: false, attempt: 0, ms: 1000 }

  it('caps choosing at Good', () => {
    expect(finalGrade({ ...base, mode: 'choose', match: 'exact' })).toBe(Rating.Good)
    expect(finalGrade({ ...base, mode: 'choose', match: 'wrong' })).toBe(Rating.Again)
  })

  it('gives Easy for a fast clean free answer, but not on a second showing', () => {
    expect(finalGrade({ ...base, mode: 'free', match: 'exact' })).toBe(Rating.Easy)
    expect(finalGrade({ ...base, mode: 'free', match: 'exact', attempt: 1 })).toBe(Rating.Good)
    expect(finalGrade({ ...base, mode: 'free', match: 'typo' })).toBe(Rating.Hard)
  })

  it('caps the grade at Hard after the translation hint', () => {
    expect(finalGrade({ ...base, mode: 'free', match: 'exact', hintUsed: true })).toBe(Rating.Hard)
    expect(finalGrade({ ...base, mode: 'free', match: null, selfGrade: Rating.Easy, hintUsed: true })).toBe(Rating.Hard)
    expect(finalGrade({ ...base, mode: 'free', match: 'wrong', hintUsed: true })).toBe(Rating.Again)
  })

  it('uses the self-grade for spoken answers', () => {
    expect(finalGrade({ ...base, mode: 'free', match: null, selfGrade: Rating.Easy })).toBe(Rating.Easy)
    expect(finalGrade({ ...base, mode: 'free', match: null, selfGrade: Rating.Easy, attempt: 1 })).toBe(Rating.Good)
    expect(finalGrade({ ...base, mode: 'free', match: null, selfGrade: Rating.Again })).toBe(Rating.Again)
  })
})
