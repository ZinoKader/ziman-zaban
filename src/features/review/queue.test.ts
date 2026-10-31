import { describe, expect, it } from 'vitest'
import { concepts, qaFor, sentencesFor, type Evidence, type EvidenceLevel } from '@/content'
import {
  buildQueue,
  EVIDENCE_RANK,
  matchesScope,
  nextKey,
  orderWithReports,
  reportsByKey,
  reportTarget,
  sortQueue,
  DEFAULT_FILTERS,
  type QueueItem,
} from './queue'

const item = (id: string, level: EvidenceLevel, kind: QueueItem['kind'] = 'concept', unit = 'greetings'): QueueItem => ({
  key: `${kind}:ckb:${id}`,
  kind,
  id,
  unit,
  level: 'A1',
  evidence: { level, checks: [] },
})

describe('review queue', () => {
  it('puts the weakest evidence first: none, attested, good, strong', () => {
    const sorted = sortQueue([item('s', 'strong'), item('g', 'good'), item('n', 'none'), item('a', 'attested'), item('r', 'native-reviewed')])
    expect(sorted.map((q) => q.evidence.level)).toEqual(['none', 'attested', 'good', 'strong', 'native-reviewed'])
  })

  it('orders by unit, then kind, within the same evidence level', () => {
    const sorted = sortQueue([
      item('later', 'good', 'concept', 'family'),
      item('q', 'good', 'qa', 'greetings'),
      item('s', 'good', 'sentence', 'greetings'),
      item('c', 'good', 'concept', 'greetings'),
    ])
    expect(sorted.map((q) => q.id)).toEqual(['c', 's', 'q', 'later'])
  })

  it('contains every item for the language, sorted by the evidence lookup', () => {
    const levels: EvidenceLevel[] = ['strong', 'none', 'good', 'attested']
    let n = 0
    const assigned = new Map<string, EvidenceLevel>()
    const lookup = (kind: string, lang: string, id: string): Evidence => {
      const level = levels[n++ % levels.length]
      assigned.set(`${kind}:${lang}:${id}`, level)
      return { level, checks: [] }
    }
    const queue = buildQueue('ckb', lookup)
    const expected = concepts.filter((c) => c.ckb).length + sentencesFor('ckb').length + qaFor('ckb').length
    expect(queue).toHaveLength(expected)
    expect(new Set(queue.map((q) => q.key)).size).toBe(expected)
    for (const q of queue) expect(q.evidence.level).toBe(assigned.get(q.key))
    const ranks = queue.map((q) => EVIDENCE_RANK[q.evidence.level])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('uses real evidence by default', () => {
    const ranks = buildQueue('fa').map((q) => EVIDENCE_RANK[q.evidence.level])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('applies kind, unit and level filters', () => {
    const q = item('x', 'good', 'sentence', 'family')
    expect(matchesScope(q, DEFAULT_FILTERS)).toBe(true)
    expect(matchesScope(q, { ...DEFAULT_FILTERS, kind: 'concept' })).toBe(false)
    expect(matchesScope(q, { ...DEFAULT_FILTERS, unit: 'family', kind: 'sentence' })).toBe(true)
    expect(matchesScope(q, { ...DEFAULT_FILTERS, level: 'A2' })).toBe(false)
  })

  it('moves to the next matching item and returns null at the end', () => {
    const list = [item('a', 'none'), item('b', 'none'), item('c', 'none')]
    expect(nextKey(list, null, () => true)).toBe('concept:ckb:a')
    expect(nextKey(list, 'concept:ckb:a', (q) => q.id !== 'b')).toBe('concept:ckb:c')
    expect(nextKey(list, 'concept:ckb:c', () => true)).toBeNull()
  })
})

describe('learner reports', () => {
  it('accept review keys and practice card keys', () => {
    expect(reportTarget('concept:ckb:water')).toBe('concept:ckb:water')
    expect(reportTarget('fa:recall:water')).toBe('concept:fa:water')
    expect(reportTarget('fa:construction:i-am-sara')).toBe('sentence:fa:i-am-sara')
    expect(reportTarget('ckb:response:what-is-your-name')).toBe('qa:ckb:what-is-your-name')
    expect(reportTarget('grammar:ckb:x')).toBeNull()
    expect(reportTarget('nonsense')).toBeNull()
  })

  it('are grouped per item for one language and float to the top', () => {
    const reports = [
      { key: 'concept:ckb:b', at: '2026-10-01T00:00:00Z', message: 'typo' },
      { key: 'ckb:recall:b', at: '2026-10-02T00:00:00Z', message: 'wrong word' },
      { key: 'concept:fa:a', at: '2026-10-02T00:00:00Z', message: 'other language' },
    ]
    const byKey = reportsByKey(reports, 'ckb')
    expect([...byKey.keys()]).toEqual(['concept:ckb:b'])
    expect(byKey.get('concept:ckb:b')).toHaveLength(2)
    const ordered = orderWithReports([item('a', 'none'), item('b', 'strong')], new Set(byKey.keys()))
    expect(ordered.map((q) => q.id)).toEqual(['b', 'a'])
  })
})
