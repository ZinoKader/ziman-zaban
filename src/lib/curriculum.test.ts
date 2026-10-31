import { conceptsFor, units } from '@/content'
import type { QAItem, Sentence, Token } from '@/content/types'
import {
  buildQueue,
  conceptUnlock,
  moduleItems,
  moduleStatus,
  qaConcepts,
  qaUnlock,
  sentenceConcepts,
  sentenceUnlock,
  type Cards,
} from './curriculum'
import { seededRandom } from './distractors'
import { cardKey, Rating, reviewCard, State, type StoredCard } from './srs'

const DAY = 86_400_000
const NOW = new Date('2026-06-15T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY)

/** A card first seen `d` days ago and answered Good `reps` times, each review right when it fell due. */
function practised(d: number, reps = 1): StoredCard {
  let card = reviewCard(undefined, Rating.Good, daysAgo(d))
  for (let i = 1; i < reps; i++) card = reviewCard(card, Rating.Good, new Date(card.due))
  return card
}

function graduated(): StoredCard {
  let card = reviewCard(undefined, Rating.Good, daysAgo(200))
  while (card.state !== State.Review) card = reviewCard(card, Rating.Good, new Date(card.due))
  return card
}

const tok = (concept?: string): Token => ({ text: 'x', latin: 'x', gloss: { en: 'x', sv: 'x' }, concept })

function sentence(concepts: Array<string | undefined>): Sentence {
  return {
    id: 'test-sentence',
    unit: 'me-and-you',
    level: 'A1',
    translation: { en: 'x', sv: 'x' },
    ckb: { text: 'x', latin: 'x', tokens: concepts.map(tok), sources: [] },
  }
}

function qa(question: string[], answer: string[], extraAnswer: string[] = []): QAItem {
  return {
    id: 'test-qa',
    unit: 'me-and-you',
    level: 'A1',
    question: { en: 'x', sv: 'x' },
    fa: {
      question: { text: 'x', latin: 'x', tokens: question.map(tok) },
      answers: [
        { text: 'x', latin: 'x', translation: { en: 'x', sv: 'x' }, tokens: answer.map(tok) },
        { text: 'y', latin: 'y', translation: { en: 'y', sv: 'y' }, tokens: extraAnswer.map(tok) },
      ],
      sources: [],
    },
  }
}

function cardsFor(entries: Array<[Parameters<typeof cardKey>, StoredCard]>): Cards {
  return Object.fromEntries(entries.map(([k, c]) => [cardKey(...k), c]))
}

describe('conceptUnlock', () => {
  const concept = conceptsFor('ckb')[0]

  it('recognition is always open', () => {
    expect(conceptUnlock(concept, 'recognition', 'ckb', {})).toEqual({ unlocked: true, missing: [] })
  })

  it('recall needs the word to have been recognised three times or learned', () => {
    const withReps = (reps: number) => {
      let card = reviewCard(undefined, Rating.Again, daysAgo(30))
      for (let i = 1; i < reps; i++) card = reviewCard(card, Rating.Again, new Date(card.due))
      expect(card.state).toBe(State.Learning)
      return cardsFor([[['ckb', 'recognition', concept.id], card]])
    }
    expect(conceptUnlock(concept, 'recall', 'ckb', {})).toEqual({ unlocked: false, missing: [concept.id] })
    expect(conceptUnlock(concept, 'recall', 'ckb', withReps(1)).unlocked).toBe(false)
    expect(conceptUnlock(concept, 'recall', 'ckb', withReps(2)).unlocked).toBe(false)
    expect(conceptUnlock(concept, 'recall', 'ckb', withReps(3))).toEqual({ unlocked: true, missing: [] })
    const learned = cardsFor([[['ckb', 'recognition', concept.id], { ...graduated(), reps: 1 }]])
    expect(conceptUnlock(concept, 'recall', 'ckb', learned).unlocked).toBe(true)
  })

  it('progress in the other language does not count', () => {
    const cards = cardsFor([[['fa', 'recognition', concept.id], practised(30, 5)]])
    expect(conceptUnlock(concept, 'recall', 'ckb', cards).unlocked).toBe(false)
  })
})

describe('sentenceUnlock', () => {
  const s = sentence(['i', 'name', undefined, 'name'])

  it('collects each token concept once and skips tokens without one', () => {
    expect(sentenceConcepts(s, 'ckb')).toEqual(['i', 'name'])
    expect(sentenceConcepts(s, 'fa')).toEqual([])
  })

  it('unlocks once every token concept has been introduced in recognition', () => {
    expect(sentenceUnlock(s, 'ckb', {})).toEqual({ unlocked: false, missing: ['i', 'name'] })
    const one = cardsFor([[['ckb', 'recognition', 'i'], practised(1)]])
    expect(sentenceUnlock(s, 'ckb', one)).toEqual({ unlocked: false, missing: ['name'] })
    const both = cardsFor([
      [['ckb', 'recognition', 'i'], practised(1)],
      [['ckb', 'recognition', 'name'], practised(1)],
    ])
    expect(sentenceUnlock(s, 'ckb', both)).toEqual({ unlocked: true, missing: [] })
  })

  it('recall cards alone do not introduce a word', () => {
    const cards = cardsFor([
      [['ckb', 'recall', 'i'], practised(1)],
      [['ckb', 'recall', 'name'], practised(1)],
    ])
    expect(sentenceUnlock(s, 'ckb', cards).unlocked).toBe(false)
  })
})

describe('qaUnlock', () => {
  const rec = (id: string): [Parameters<typeof cardKey>, StoredCard] => [['fa', 'recognition', id], practised(5, 3)]
  const call = (id: string): [Parameters<typeof cardKey>, StoredCard] => [['fa', 'recall', id], practised(5)]

  it('uses the question and the first answer only', () => {
    expect(qaConcepts(qa(['what', 'name'], ['name', 'i'], ['you']), 'fa')).toEqual(['what', 'name', 'i'])
  })

  it('unlocks when every word can be recalled', () => {
    const item = qa(['what', 'name'], ['i', 'name'])
    expect(qaUnlock(item, 'fa', cardsFor([call('what'), call('name'), call('i')]))).toEqual({ unlocked: true, missing: [] })
  })

  it('allows up to a third of the words to be known only receptively', () => {
    const item = qa(['what', 'name', 'you'], ['i', 'name', 'to-be'])
    const five = ['what', 'name', 'you', 'i', 'to-be']
    expect(qaConcepts(item, 'fa')).toHaveLength(5)
    // floor(5 / 3) = 1 receptive word allowed
    const oneReceptive = cardsFor([...five.slice(1).map(call), rec('what')])
    expect(qaUnlock(item, 'fa', oneReceptive).unlocked).toBe(true)
    const twoReceptive = cardsFor([...five.slice(2).map(call), rec('what'), rec('name')])
    expect(qaUnlock(item, 'fa', twoReceptive)).toEqual({ unlocked: false, missing: ['what', 'name'] })
  })

  it('stays locked while any word has not even been introduced', () => {
    const item = qa(['what', 'name', 'you'], ['i', 'name', 'to-be'])
    const cards = cardsFor(['name', 'you', 'i', 'to-be'].map(call))
    expect(qaUnlock(item, 'fa', cards)).toEqual({ unlocked: false, missing: ['what'] })
  })

  it('with fewer than three words, all must be recallable', () => {
    const item = qa(['what'], ['name'])
    expect(qaUnlock(item, 'fa', cardsFor([call('what'), rec('name')])).unlocked).toBe(false)
  })

  it('an item without concept tokens is open', () => {
    expect(qaUnlock(qa([], []), 'fa', {}).unlocked).toBe(true)
    expect(qaUnlock(qa([], []), 'ckb', {}).unlocked).toBe(true)
  })
})

describe('moduleItems / moduleStatus on real content', () => {
  it('lists recognition items in curriculum (unit) order', () => {
    const items = moduleItems('recognition', 'ckb', {})
    expect(items.length).toBe(conceptsFor('ckb').length)
    const orders = items.map((it) => it.order)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
    const unitRank = new Map(units.map((u) => [u.id, u.order]))
    const ranks = items.map((it) => unitRank.get(it.unit) ?? 999)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })

  it('nothing is unlocked beyond recognition for a new learner, unless it has no words to learn', () => {
    expect(moduleItems('recall', 'fa', {}).every((it) => !it.unlock.unlocked)).toBe(true)
    for (const it of moduleItems('construction', 'fa', {})) expect(it.unlock.unlocked).toBe(it.unlock.missing.length === 0)
  })

  it('counts started, due and available items', () => {
    const [a, b, c] = conceptsFor('ckb')
    const cards = cardsFor([
      [['ckb', 'recognition', a.id], practised(30)],
      [['ckb', 'recognition', b.id], practised(30)],
      [['ckb', 'recognition', c.id], { ...practised(30), due: new Date(NOW.getTime() + DAY).toISOString() }],
    ])
    const status = moduleStatus('recognition', 'ckb', cards, NOW)
    expect(status).toMatchObject({ total: conceptsFor('ckb').length, started: 3, due: 2, learned: 0 })
    expect(status.available).toBe(status.total - 3)
  })
})

describe('buildQueue', () => {
  const ids = conceptsFor('ckb').map((c) => c.id)
  const opts = { size: 10, maxNew: 4, now: NOW, random: seededRandom('queue') }

  it('a new learner gets the first new words in curriculum order', () => {
    const q = buildQueue('recognition', 'ckb', {}, opts)
    expect(q.map((c) => c.itemId)).toEqual(ids.slice(0, 4))
    expect(q.every((c) => c.isNew && !c.card)).toBe(true)
    expect(q[0].key).toBe(cardKey('ckb', 'recognition', ids[0]))
  })

  it('respects maxNew and size', () => {
    expect(buildQueue('recognition', 'ckb', {}, { ...opts, maxNew: 2 })).toHaveLength(2)
    expect(buildQueue('recognition', 'ckb', {}, { ...opts, size: 3, maxNew: 10 })).toHaveLength(3)
    expect(buildQueue('recognition', 'ckb', {}, { ...opts, maxNew: 0 })).toEqual([])
  })

  it('puts due reviews first and interleaves new items between them', () => {
    const cards = cardsFor(ids.slice(0, 4).map((id) => [['ckb', 'recognition', id], practised(20)]))
    const q = buildQueue('recognition', 'ckb', cards, { ...opts, maxNew: 2 })
    expect(q.map((c) => (c.isNew ? 'N' : 'R')).join('')).toBe('RRNRRN')
    expect(q.filter((c) => c.isNew).map((c) => c.itemId)).toEqual(ids.slice(4, 6))
  })

  it('reviews fill the session before new items, and size caps reviews too', () => {
    const cards = cardsFor(ids.slice(0, 6).map((id) => [['ckb', 'recognition', id], practised(20)]))
    const q = buildQueue('recognition', 'ckb', cards, { ...opts, size: 5, maxNew: 3 })
    expect(q).toHaveLength(5)
    expect(q.every((c) => !c.isNew)).toBe(true)
  })

  it('skips cards that are not due yet', () => {
    const notDue = { ...practised(1), due: new Date(NOW.getTime() + 3 * DAY).toISOString() }
    const cards = cardsFor([
      [['ckb', 'recognition', ids[0]], notDue],
      [['ckb', 'recognition', ids[1]], practised(10)],
    ])
    const q = buildQueue('recognition', 'ckb', cards, { ...opts, maxNew: 0 })
    expect(q.map((c) => c.itemId)).toEqual([ids[1]])
  })

  it('orders due reviews weakest first', () => {
    const cards = cardsFor([
      [['ckb', 'recognition', ids[0]], practised(2)],
      [['ckb', 'recognition', ids[1]], practised(90)],
      [['ckb', 'recognition', ids[2]], practised(10)],
    ])
    const q = buildQueue('recognition', 'ckb', cards, { ...opts, maxNew: 0 })
    expect(q.map((c) => c.itemId)).toEqual([ids[1], ids[2], ids[0]])
  })

  it('only offers unlocked new items', () => {
    expect(buildQueue('recall', 'ckb', {}, opts)).toEqual([])
    const cards = cardsFor([
      [['ckb', 'recognition', ids[3]], practised(30, 3)],
      [['ckb', 'recognition', ids[1]], practised(30, 1)],
    ])
    expect(buildQueue('recall', 'ckb', cards, opts).map((c) => c.itemId)).toEqual([ids[3]])
  })

  it('filters by unit', () => {
    const unit = conceptsFor('fa').at(-1)!.unit
    const inUnit = conceptsFor('fa').filter((c) => c.unit === unit).map((c) => c.id)
    const q = buildQueue('recognition', 'fa', {}, { ...opts, size: 100, maxNew: 100, units: [unit] })
    expect(q.map((c) => c.itemId)).toEqual(inUnit)
    expect(buildQueue('recognition', 'fa', {}, { ...opts, units: ['no-such-unit'] })).toEqual([])
  })

  it('is deterministic for a given random source', () => {
    // Identical cards tie on retrievability, so their order comes from the random source.
    const same = practised(15)
    const cards = cardsFor(ids.slice(0, 8).map((id) => [['ckb', 'recognition', id], same]))
    const run = (seed: string) =>
      buildQueue('recognition', 'ckb', cards, { ...opts, random: seededRandom(seed) }).map((c) => c.itemId)
    expect(run('a')).toEqual(run('a'))
    expect(new Set(run('a'))).toEqual(new Set([...ids.slice(0, 8), ...ids.slice(8, 10)]))
    const orders = new Set(['a', 'b', 'c', 'd', 'e'].map((s) => run(s).join()))
    expect(orders.size).toBeGreaterThan(1)
  })
})
