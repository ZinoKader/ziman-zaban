import { describe, expect, it } from 'vitest'
import { concepts } from '@/content'
import type { Concept } from '@/content/types'
import { buildWordIndex, foldBase, searchWords } from './search-index'

const ids = (lang: 'ckb' | 'fa', q: string, compare = false) =>
  searchWords(buildWordIndex(concepts, lang, compare), q).map((m) => m.concept.id)

const fixture: Concept[] = [
  {
    id: 'water',
    unit: 'food-drink',
    pos: 'noun',
    level: 'A1',
    gloss: { en: 'water', sv: 'vatten' },
    ckb: { primary: { script: 'ئاو', latin: 'aw' }, sources: [] },
    fa: { primary: { script: 'آب', latin: 'âb' }, sources: [] },
  },
  {
    id: 'bread',
    unit: 'food-drink',
    pos: 'noun',
    level: 'A1',
    gloss: { en: 'bread', sv: 'bröd', svAlt: ['limpa'] },
    ckb: { primary: { script: 'نان', latin: 'nan' }, variants: [{ script: 'نانێک', latin: 'nanêk' }], sources: [] },
    fa: { primary: { script: 'نان', latin: 'nân' }, sources: [] },
  },
  {
    id: 'tea',
    unit: 'food-drink',
    pos: 'noun',
    level: 'A1',
    gloss: { en: 'tea', sv: 'te' },
    fa: { primary: { script: 'چای', latin: 'chây' }, sources: [] },
  },
]

describe('foldBase', () => {
  it('ignores case, accents and punctuation', () => {
    expect(foldBase('Hur mår du?')).toBe('hur mar du')
    expect(foldBase('  Ålder ')).toBe('alder')
  })
})

describe('searchWords on a fixture', () => {
  it('only indexes concepts that exist in the target language', () => {
    expect(buildWordIndex(fixture, 'ckb').map((e) => e.concept.id)).toEqual(['water', 'bread'])
  })

  it('returns everything for an empty query', () => {
    expect(searchWords(buildWordIndex(fixture, 'fa'), '  ')).toHaveLength(3)
  })

  it('matches English, Swedish and Swedish alternatives', () => {
    const index = buildWordIndex(fixture, 'ckb')
    expect(searchWords(index, 'Water').map((m) => m.concept.id)).toEqual(['water'])
    expect(searchWords(index, 'bröd').map((m) => m.concept.id)).toEqual(['bread'])
    expect(searchWords(index, 'brod').map((m) => m.concept.id)).toEqual(['bread'])
    expect(searchWords(index, 'limpa').map((m) => m.concept.id)).toEqual(['bread'])
  })

  it('matches variants in script and romanization', () => {
    const index = buildWordIndex(fixture, 'ckb')
    expect(searchWords(index, 'نانێک').map((m) => m.concept.id)).toEqual(['bread'])
    expect(searchWords(index, 'nanek').map((m) => m.concept.id)).toEqual(['bread'])
  })

  it('ranks exact matches above partial ones', () => {
    const index = buildWordIndex(fixture, 'ckb')
    const results = searchWords(index, 'a')
    expect(results[0].concept.id).toBe('water')
  })
})

describe('searchWords on course content (Sorani)', () => {
  it('finds words by English meaning, best match first', () => {
    const r = ids('ckb', 'thank')
    expect(r[0]).toBe('thank-you')
    expect(r).toContain('thanks-a-lot')
  })

  it('finds words by Swedish meaning, including whole words inside a phrase', () => {
    expect(ids('ckb', 'tack')[0]).toBe('thank-you')
    expect(ids('ckb', 'mamma')).toContain('mother')
    expect(ids('ckb', 'mormor')).toContain('grandmother')
    expect(ids('ckb', 'alder')).toContain('age')
  })

  it('finds words written in Sorani script, tolerating Arabic letter variants', () => {
    expect(ids('ckb', 'سوپاس')[0]).toBe('thank-you')
    expect(ids('ckb', 'خوشك')).toContain('sister')
  })

  it('finds words by romanization without special letters', () => {
    expect(ids('ckb', 'supas')[0]).toBe('thank-you')
    expect(ids('ckb', 'bibure')).toContain('sorry')
    expect(ids('ckb', 'xwa hafiz')).toContain('goodbye')
  })

  it('searches the other language only in compare mode', () => {
    expect(ids('ckb', 'ممنون')).toEqual([])
    expect(ids('ckb', 'ممنون', true)).toContain('thank-you')
  })

  it('returns nothing for a query that matches no word', () => {
    expect(ids('ckb', 'qqqq')).toEqual([])
  })
})

describe('searchWords on course content (Persian)', () => {
  it('finds Persian script with Arabic yeh and kaf', () => {
    expect(ids('fa', 'خداحافظ')[0]).toBe('goodbye')
    expect(ids('fa', 'خيلي ممنون')).toContain('thanks-a-lot')
  })

  it('finds Persian romanizations with or without circumflexes, and variants', () => {
    expect(ids('fa', 'khodahafez')).toContain('goodbye')
    expect(ids('fa', 'shoma')).toContain('you-plural')
    expect(ids('fa', 'mersi')).toContain('thank-you')
  })
})
