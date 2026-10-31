import { describe, expect, it } from 'vitest'
import { ZWNJ } from '@/lib/script/normalize'
import { diffChars, diffSimilarity, joinsNext } from './diff'

const join = (ops: ReturnType<typeof diffChars>, keep: 'answer' | 'expected') =>
  ops
    .filter((o) => o.type === 'equal' || o.type === (keep === 'answer' ? 'extra' : 'missing'))
    .map((o) => o.text)
    .join('')

describe('diffChars', () => {
  it('returns a single equal op for identical strings', () => {
    expect(diffChars('supas', 'supas')).toEqual([{ type: 'equal', text: 'supas' }])
  })

  it('marks a missing letter', () => {
    expect(diffChars('sups', 'supas')).toEqual([
      { type: 'equal', text: 'sup' },
      { type: 'missing', text: 'a' },
      { type: 'equal', text: 's' },
    ])
  })

  it('marks an extra letter', () => {
    expect(diffChars('suppas', 'supas')).toEqual([
      { type: 'equal', text: 'sup' },
      { type: 'extra', text: 'p' },
      { type: 'equal', text: 'as' },
    ])
  })

  it('puts the wrong letter before the right one at a substitution', () => {
    expect(diffChars('salam', 'salâm')).toEqual([
      { type: 'equal', text: 'sal' },
      { type: 'extra', text: 'a' },
      { type: 'missing', text: 'â' },
      { type: 'equal', text: 'm' },
    ])
  })

  it('handles empty strings', () => {
    expect(diffChars('', 'ab')).toEqual([{ type: 'missing', text: 'ab' }])
    expect(diffChars('ab', '')).toEqual([{ type: 'extra', text: 'ab' }])
    expect(diffChars('', '')).toEqual([])
  })

  it('works on Arabic script and shows a missing half space', () => {
    const ops = diffChars('میخورم', `می${ZWNJ}خورم`)
    expect(ops).toEqual([
      { type: 'equal', text: 'می' },
      { type: 'missing', text: ZWNJ },
      { type: 'equal', text: 'خورم' },
    ])
  })

  it('splits Sorani letters by code point', () => {
    const ops = diffChars('سلاو', 'سڵاو')
    expect(ops.map((o) => o.type)).toEqual(['equal', 'extra', 'missing', 'equal'])
    expect(ops[2].text).toBe('ڵ')
  })

  it('always reconstructs both strings', () => {
    const pairs: Array<[string, string]> = [
      ['xwat legel', 'xwat legeł'],
      ['khodahafez', 'khodâhâfez'],
      ['abcdef', 'azced'],
      ['ممنونم', 'ممنون'],
    ]
    for (const [a, b] of pairs) {
      const ops = diffChars(a, b)
      expect(join(ops, 'answer')).toBe(a)
      expect(join(ops, 'expected')).toBe(b)
    }
  })
})

describe('joinsNext', () => {
  it('joins letters that connect forward to a following letter', () => {
    expect(joinsNext('س', 'ڵ')).toBe(true)
    expect(joinsNext('ڵ', 'ا')).toBe(true)
    expect(joinsNext('ب', 'ی')).toBe(true)
  })
  it('does not join after letters that only connect backward, or around spaces and Latin', () => {
    for (const left of ['ا', 'د', 'ر', 'ڕ', 'ز', 'ژ', 'و', 'ۆ', 'ە']) expect(joinsNext(left, 'ب')).toBe(false)
    expect(joinsNext('س', ' ')).toBe(false)
    expect(joinsNext('س', ZWNJ)).toBe(false)
    expect(joinsNext('s', 'a')).toBe(false)
    expect(joinsNext(undefined, 'ب')).toBe(false)
  })
})

describe('diffSimilarity', () => {
  it('is the share of expected letters the answer got right', () => {
    expect(diffSimilarity(diffChars('supas', 'supas'))).toBe(1)
    expect(diffSimilarity(diffChars('sups', 'supas'))).toBeCloseTo(0.8)
    expect(diffSimilarity(diffChars('xyz', 'supas'))).toBe(0)
  })
})
