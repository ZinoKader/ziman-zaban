import { conceptsFor, units } from '@/content'
import { moduleStatus, type Cards } from '@/lib/curriculum'
import { cardKey, isLearned, Rating, reviewCard, State, type StoredCard } from '@/lib/srs'
import { cardsBefore, useProgress, type DayStats } from '@/store/progress'
import {
  accuracy,
  activity,
  courseProgress,
  forecast,
  hardestWords,
  moduleProgress,
  sessionGain,
  startedLanguages,
  unitProgress,
  wordState,
} from './progress-data'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)
const now = at(2026, 3, 10, 9)
const words = conceptsFor('ckb')

const learning = (t = now) => reviewCard(undefined, Rating.Good, t)
const learned = (t = now) => reviewCard(undefined, Rating.Easy, t)
const lapsed = (times: number, t = now): StoredCard => {
  let c = learned(t)
  for (let i = 0; i < times; i++) {
    c = reviewCard(c, Rating.Again, new Date(c.due))
    c = reviewCard(c, Rating.Easy, new Date(c.due))
  }
  return c
}
const dueAt = (due: Date): StoredCard => ({ ...learned(), due: due.toISOString() })
const stats = (reviews: number, correct = reviews): DayStats => ({ reviews, correct, newItems: 0, ms: 0 })

describe('test fixtures', () => {
  it('match the srs definitions of learning and learned', () => {
    expect(learning().state).toBe(State.Learning)
    expect(isLearned(learning())).toBe(false)
    expect(isLearned(learned())).toBe(true)
    expect(lapsed(2).lapses).toBe(2)
  })
})

describe('wordState and courseProgress', () => {
  it('a word is new, learning once practised, learned once either word card graduated', () => {
    const [a, b, c] = words
    const cards: Cards = {
      [cardKey('ckb', 'recognition', a.id)]: learning(),
      [cardKey('ckb', 'recognition', b.id)]: learning(),
      [cardKey('ckb', 'recall', b.id)]: learned(),
    }
    expect(wordState(cards, 'ckb', a.id)).toBe('learning')
    expect(wordState(cards, 'ckb', b.id)).toBe('learned')
    expect(wordState(cards, 'ckb', c.id)).toBe('new')
    expect(wordState(cards, 'fa', b.id)).toBe('new')
  })

  it('counts learned and learning words out of all course words', () => {
    const cards: Cards = {
      [cardKey('ckb', 'recognition', words[0].id)]: learned(),
      [cardKey('ckb', 'recognition', words[1].id)]: learned(),
      [cardKey('ckb', 'recognition', words[2].id)]: learning(),
      [cardKey('ckb', 'construction', 'some-sentence')]: learned(),
    }
    expect(courseProgress('ckb', cards)).toEqual({ learned: 2, learning: 1, total: words.length })
    expect(courseProgress('fa', cards)).toEqual({ learned: 0, learning: 0, total: conceptsFor('fa').length })
  })
})

describe('moduleProgress', () => {
  it('reports the curriculum status of all four modules in path order', () => {
    const cards: Cards = { [cardKey('ckb', 'recognition', words[0].id)]: learned() }
    const m = moduleProgress('ckb', cards, now)
    expect(m.map((x) => x.skill)).toEqual(['recognition', 'recall', 'construction', 'response'])
    expect(m[0].status).toEqual(moduleStatus('recognition', 'ckb', cards, now))
    expect(m[0].status.learned).toBe(1)
  })

  it('splits started module items into learned and in progress, matching the course bar', () => {
    const cards: Cards = {
      [cardKey('ckb', 'recognition', words[0].id)]: learned(),
      [cardKey('ckb', 'recognition', words[1].id)]: learning(),
      [cardKey('ckb', 'recognition', words[2].id)]: learning(),
      [cardKey('ckb', 'recall', words[3].id)]: learning(),
    }
    const [recognition, recall] = moduleProgress('ckb', cards, now).map((m) => m.status)
    expect(recognition).toMatchObject({ learned: 1, started: 3 })
    expect(recall).toMatchObject({ learned: 0, started: 1 })
    expect(courseProgress('ckb', cards)).toEqual({ learned: 1, learning: 3, total: words.length })
  })
})

describe('unitProgress', () => {
  it('lists units in order with word bars and a state', () => {
    const first = [...units].sort((a, b) => a.order - b.order)[0]
    const inFirst = words.filter((w) => w.unit === first.id)
    const cards: Cards = Object.fromEntries(inFirst.map((w) => [cardKey('ckb', 'recognition', w.id), learned()]))
    const rows = unitProgress('ckb', cards)
    expect(rows.map((r) => r.unit.id)).toEqual([...units].sort((a, b) => a.order - b.order).map((u) => u.id))
    expect(rows[0].words).toEqual({ learned: inFirst.length, learning: 0, total: inFirst.length })
    expect(rows[0].state).toBe('done')
    expect(rows[1].state).toBe('upcoming')
    expect(rows.reduce((n, r) => n + r.words.total, 0)).toBe(words.length)
  })

  it('marks a partly practised unit active and counts unlocked sentences', () => {
    const rows = unitProgress('ckb', { [cardKey('ckb', 'recognition', words[0].id)]: learning() })
    const row = rows.find((r) => r.unit.id === words[0].unit)!
    expect(row.state).toBe('active')
    expect(row.sentences.unlocked).toBeLessThanOrEqual(row.sentences.total)
  })
})

describe('startedLanguages', () => {
  it('returns practised languages in a fixed order', () => {
    expect(startedLanguages({})).toEqual([])
    expect(startedLanguages({ [cardKey('fa', 'recall', 'x')]: learned(), [cardKey('ckb', 'recall', 'y')]: learned() })).toEqual(['ckb', 'fa'])
  })
})

describe('activity and accuracy', () => {
  it('returns the last 14 local days, oldest first, across a month boundary', () => {
    const a = activity({ '2026-03-10': stats(5, 4), '2026-02-25': stats(2), '2026-02-24': stats(9) }, now, 14)
    expect(a).toHaveLength(14)
    expect(a[0].day).toBe('2026-02-25')
    expect(a.at(-1)).toMatchObject({ day: '2026-03-10', reviews: 5, correct: 4 })
    expect(a[0].reviews).toBe(2)
    expect(a.reduce((n, d) => n + d.reviews, 0)).toBe(7)
  })

  it('computes accuracy over the last 7 days only', () => {
    const days = { '2026-03-10': stats(10, 8), '2026-03-04': stats(10, 6), '2026-03-03': stats(50, 0) }
    expect(accuracy(days, now, 7)).toEqual({ reviews: 20, correct: 14, pct: 70 })
    expect(accuracy({}, now).pct).toBeNull()
  })
})

describe('forecast', () => {
  it('buckets due cards by local day, overdue ones today, ignoring other languages and later dates', () => {
    const cards: Cards = {
      [cardKey('ckb', 'recognition', 'a')]: dueAt(at(2026, 3, 1)),
      [cardKey('ckb', 'recognition', 'b')]: dueAt(at(2026, 3, 10, 23)),
      [cardKey('ckb', 'recall', 'c')]: dueAt(at(2026, 3, 11, 0)),
      [cardKey('ckb', 'construction', 'd')]: dueAt(at(2026, 3, 16, 23)),
      [cardKey('ckb', 'response', 'e')]: dueAt(at(2026, 3, 17, 1)),
      [cardKey('fa', 'recognition', 'f')]: dueAt(at(2026, 3, 10)),
    }
    const f = forecast(cards, 'ckb', now, 7)
    expect(f.map((d) => d.day)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16'])
    expect(f.map((d) => d.count)).toEqual([2, 1, 0, 0, 0, 0, 1])
  })
})

describe('hardestWords', () => {
  it('ranks words by lapses summed over recognition and recall', () => {
    const [a, b, c, d] = words
    const cards: Cards = {
      [cardKey('ckb', 'recognition', a.id)]: lapsed(1),
      [cardKey('ckb', 'recognition', b.id)]: lapsed(1),
      [cardKey('ckb', 'recall', b.id)]: lapsed(2),
      [cardKey('ckb', 'recognition', c.id)]: learned(),
      [cardKey('fa', 'recognition', d.id)]: lapsed(4),
    }
    const hard = hardestWords(cards, 'ckb')
    expect(hard.map((h) => [h.concept.id, h.lapses])).toEqual([
      [b.id, 3],
      [a.id, 1],
    ])
    expect(hardestWords(cards, 'ckb', 1)).toHaveLength(1)
  })
})

describe('sessionGain and cardsBefore', () => {
  beforeEach(() => useProgress.setState({ cards: {}, log: [], days: {}, daysByLang: {}, reports: [] }))

  it('reconstructs the cards before a session and finds newly learned words', () => {
    const [a, b] = words
    const { record } = useProgress.getState()
    const t0 = at(2026, 3, 9, 8)
    record(cardKey('ckb', 'recognition', a.id), Rating.Good, { ms: 1, kind: 'mc', now: t0 })
    const start = at(2026, 3, 10, 8).getTime()
    record(cardKey('ckb', 'recognition', a.id), Rating.Easy, { ms: 1, kind: 'mc', now: new Date(start + 1000) })
    record(cardKey('ckb', 'recognition', b.id), Rating.Good, { ms: 1, kind: 'mc', now: new Date(start + 2000) })

    const after = useProgress.getState().cards
    const before = cardsBefore(start, after)
    expect(before[cardKey('ckb', 'recognition', a.id)]!.reps).toBe(1)
    expect(before[cardKey('ckb', 'recognition', b.id)]).toBeUndefined()

    const gain = sessionGain('recognition', 'ckb', before, after, now)
    expect(gain.newlyLearned.map((c) => c.id)).toEqual([a.id])
    expect(gain.course.before).toMatchObject({ learned: 0, learning: 1 })
    expect(gain.course.after).toMatchObject({ learned: 1, learning: 1 })
    expect(gain.module.before.started).toBe(1)
    expect(gain.module.after.started).toBe(2)
  })
})
