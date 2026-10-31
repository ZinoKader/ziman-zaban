import { describe, expect, it } from 'vitest'
import { grammarById, grammarPoints, sentences, units } from '@/content'
import type { GrammarPoint } from '@/content/types'
import { counterpartOf, formatCitation, groupByUnit, readingOrder, sentencesWithGrammar } from './grammar-data'
import { grammarStrings } from './strings'

const point = (id: string, unit = 'family'): GrammarPoint => ({
  id,
  unit,
  lang: id.startsWith('fa-') ? 'fa' : 'ckb',
  level: 'A1',
  title: { en: id, sv: id },
  explanation: { en: '', sv: '' },
  examples: [],
  sources: [],
})

describe('groupByUnit', () => {
  it('groups in curriculum order and handles no content', () => {
    const groups = groupByUnit([point('ckb-b', 'family'), point('ckb-a', 'me-and-you'), point('fa-a')], 'ckb', units)
    expect(groups.map((g) => g.unitId)).toEqual(['me-and-you', 'family'])
    expect(groupByUnit([], 'fa', units)).toEqual([])
  })

  it('orders the real Sorani points from unit 2 onwards', () => {
    const order = readingOrder(grammarPoints, 'ckb', units)
    expect(order.length).toBeGreaterThan(0)
    expect(order.findIndex((p) => p.id === 'ckb-pronouns')).toBeLessThan(order.findIndex((p) => p.id === 'ckb-plural'))
  })
})

describe('counterpartOf', () => {
  const all = [
    point('ckb-ezafe'),
    point('fa-ezafe'),
    point('ckb-possessive-clitics'),
    point('fa-possessive-suffixes'),
    point('ckb-definite-ekan'),
    point('fa-indefinite-i'),
    point('ckb-politeness'),
    point('fa-formal-colloquial'),
  ]
  const find = (id: string) => counterpartOf(all.find((p) => p.id === id)!, all)?.id

  it('pairs ids that differ only by prefix', () => {
    expect(find('ckb-ezafe')).toBe('fa-ezafe')
    expect(find('fa-ezafe')).toBe('ckb-ezafe')
  })

  it('pairs ids that share the topic word', () => {
    expect(find('ckb-possessive-clitics')).toBe('fa-possessive-suffixes')
    expect(find('fa-possessive-suffixes')).toBe('ckb-possessive-clitics')
    expect(find('ckb-politeness')).toBe('fa-formal-colloquial')
  })

  it('returns nothing when there is no counterpart', () => {
    expect(find('ckb-definite-ekan')).toBeUndefined()
    expect(find('fa-indefinite-i')).toBeUndefined()
  })
})

describe('sentencesWithGrammar', () => {
  it('finds course sentences that reference a grammar point', () => {
    const found = sentencesWithGrammar(sentences, 'ckb', 'ckb-copula')
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((s) => s.ckb?.grammar?.includes('ckb-copula'))).toBe(true)
  })
})

describe('formatCitation', () => {
  const en = grammarStrings.get('en')
  const sv = grammarStrings.get('sv')

  it('formats book sections and chapters', () => {
    expect(formatCitation({ source: 'thackston-sorani-grammar', ref: '§15' }, en)).toBe(
      'W. M. Thackston, Sorani Kurdish: A Reference Grammar with Selected Readings, §15',
    )
    expect(formatCitation({ source: 'kim-kurdish-grammar', ref: 'Linking verbs' }, en)).toBe(
      'D. H. Kim, A Basic Guide to Kurdish Grammar, chapter “Linking verbs”',
    )
    expect(formatCitation({ source: 'kim-kurdish-grammar', ref: 'Izafe' }, sv)).toBe(
      'D. H. Kim, A Basic Guide to Kurdish Grammar, kapitlet ”Izafe”',
    )
  })

  it('formats other sources', () => {
    expect(formatCitation({ source: 'author' }, en)).toBe('Written by the course author')
    expect(formatCitation({ source: 'tatoeba' }, sv)).toBe('Tatoebas meningskorpus')
  })

  it('has a citation for every source used in grammar content', () => {
    for (const g of grammarById.values()) for (const src of g.sources) expect(en.citation[src.source]).toBeTruthy()
  })
})
