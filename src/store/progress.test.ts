import { cardKey, Rating, reviewCard, State } from '@/lib/srs'
import { dayKey, streak, useProgress, type DayStats } from './progress'

const water = cardKey('ckb', 'recognition', 'water')
const waterFa = cardKey('fa', 'recognition', 'water')
const recallName = cardKey('ckb', 'recall', 'name')

const empty = { cards: {}, log: [], days: {}, reports: [] }
const day = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

beforeEach(() => useProgress.setState(empty))

describe('dayKey', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(dayKey(day(2026, 1, 5))).toBe('2026-01-05')
    expect(dayKey(day(2026, 12, 31, 23, 59))).toBe('2026-12-31')
    expect(dayKey(day(2027, 1, 1, 0, 1))).toBe('2027-01-01')
  })
})

describe('record', () => {
  it('creates a card, a log entry and day stats for a new item', () => {
    const now = day(2026, 3, 2, 9)
    const card = useProgress.getState().record(water, Rating.Good, { ms: 3200, kind: 'mc-meaning', now })
    const s = useProgress.getState()
    expect(s.cards[water]).toEqual(card)
    expect(card).toEqual(reviewCard(undefined, Rating.Good, now))
    expect(s.log).toEqual([{ key: water, grade: Rating.Good, at: now.toISOString(), ms: 3200, kind: 'mc-meaning' }])
    expect(s.days[dayKey(now)]).toEqual({ reviews: 1, correct: 1, newItems: 1, ms: 3200 })
  })

  it('updates the same card on later reviews and only counts it as new once', () => {
    const { record } = useProgress.getState()
    const first = record(water, Rating.Good, { ms: 1000, kind: 'mc-meaning', now: day(2026, 3, 2, 9) })
    const second = record(water, Rating.Good, { ms: 1000, kind: 'typed', now: day(2026, 3, 2, 10) })
    expect(second.reps).toBe(2)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.state).toBe(State.Review)
    const s = useProgress.getState()
    expect(Object.keys(s.cards)).toEqual([water])
    expect(s.log.map((e) => e.kind)).toEqual(['mc-meaning', 'typed'])
    expect(s.days['2026-03-02']).toMatchObject({ reviews: 2, newItems: 1 })
  })

  it('counts Again as not correct and lapses the card', () => {
    const { record } = useProgress.getState()
    record(water, Rating.Good, { ms: 1000, kind: 'typed', now: day(2026, 3, 2, 9) })
    record(water, Rating.Good, { ms: 1000, kind: 'typed', now: day(2026, 3, 2, 10) })
    const due = new Date(useProgress.getState().cards[water]!.due)
    const lapsed = record(water, Rating.Again, { ms: 1000, kind: 'typed', now: due })
    expect(lapsed.lapses).toBe(1)
    expect(useProgress.getState().days[dayKey(due)]).toMatchObject({ reviews: 1, correct: 0, newItems: 0 })
  })

  it('caps time per review at two minutes', () => {
    const now = day(2026, 3, 2)
    useProgress.getState().record(water, Rating.Hard, { ms: 10 * 60_000, kind: 'typed', now })
    expect(useProgress.getState().days[dayKey(now)]).toMatchObject({ ms: 120_000, correct: 1 })
  })

  it('files reviews under the local day they happened on', () => {
    const { record } = useProgress.getState()
    record(water, Rating.Good, { ms: 1, kind: 'typed', now: day(2026, 3, 2, 23, 59) })
    record(recallName, Rating.Good, { ms: 1, kind: 'typed', now: day(2026, 3, 3, 0, 1) })
    expect(Object.keys(useProgress.getState().days).sort()).toEqual(['2026-03-02', '2026-03-03'])
  })

  it('keeps the review log bounded', () => {
    const { record } = useProgress.getState()
    const now = day(2026, 3, 2)
    for (let i = 0; i < 5003; i++) record(cardKey('fa', 'recall', `item-${i % 50}`), Rating.Good, { ms: 1, kind: 'typed', now })
    const { log } = useProgress.getState()
    expect(log).toHaveLength(5000)
    expect(log.at(-1)!.key).toBe(cardKey('fa', 'recall', `item-${5002 % 50}`))
  })

  it('persists to localStorage', () => {
    useProgress.getState().record(water, Rating.Good, { ms: 1, kind: 'typed', now: day(2026, 3, 2) })
    const stored = JSON.parse(localStorage.getItem('zz-progress')!)
    expect(stored.state.cards[water].reps).toBe(1)
    expect(typeof stored.state.cards[water].due).toBe('string')
  })
})

describe('streak', () => {
  const stats = (reviews: number): DayStats => ({ reviews, correct: reviews, newItems: 0, ms: 0 })
  const now = day(2026, 3, 10, 8)

  it('counts consecutive days ending today', () => {
    expect(streak({ '2026-03-10': stats(3), '2026-03-09': stats(1), '2026-03-08': stats(2) }, now)).toBe(3)
  })

  it('still counts a streak ending yesterday (today not practised yet)', () => {
    expect(streak({ '2026-03-09': stats(1), '2026-03-08': stats(2) }, now)).toBe(2)
  })

  it('a gap or a zero-review day breaks it', () => {
    expect(streak({ '2026-03-10': stats(1), '2026-03-08': stats(2) }, now)).toBe(1)
    expect(streak({ '2026-03-10': stats(1), '2026-03-09': stats(0), '2026-03-08': stats(2) }, now)).toBe(1)
    expect(streak({ '2026-03-07': stats(5) }, now)).toBe(0)
    expect(streak({}, now)).toBe(0)
  })

  it('crosses month and year boundaries', () => {
    const days = { '2027-01-01': stats(1), '2026-12-31': stats(1), '2026-12-30': stats(1) }
    expect(streak(days, day(2027, 1, 1, 20))).toBe(3)
    expect(streak({ '2026-03-01': stats(1), '2026-02-28': stats(1) }, day(2026, 3, 1))).toBe(2)
  })

  it('works on the days recorded by record()', () => {
    const { record } = useProgress.getState()
    for (const d of [8, 9, 10]) record(water, Rating.Good, { ms: 1, kind: 'typed', now: day(2026, 3, d, 21) })
    expect(streak(useProgress.getState().days, now)).toBe(3)
  })
})

describe('export / import', () => {
  it('round-trips through JSON and keeps scheduling identically', () => {
    const { record } = useProgress.getState()
    record(water, Rating.Good, { ms: 1500, kind: 'typed', now: day(2026, 3, 2, 9) })
    record(waterFa, Rating.Hard, { ms: 2500, kind: 'mc-meaning', now: day(2026, 3, 2, 9, 5) })
    record(water, Rating.Good, { ms: 900, kind: 'typed', now: day(2026, 3, 2, 9, 20) })
    const { cards, log, days } = useProgress.getState()
    const file = JSON.stringify({ cards, log, days }, null, 2)

    useProgress.setState(empty)
    const data = JSON.parse(file)
    useProgress.getState().importState({ cards: data.cards, log: data.log, days: data.days })
    const s = useProgress.getState()
    expect(s.cards).toEqual(cards)
    expect(s.log).toEqual(log)
    expect(s.days).toEqual(days)

    const later = day(2026, 3, 9)
    const afterImport = s.record(water, Rating.Good, { ms: 1, kind: 'typed', now: later })
    expect(afterImport).toEqual(reviewCard(cards[water], Rating.Good, later))
  })

  it('rehydrates the persisted state', async () => {
    useProgress.getState().record(water, Rating.Good, { ms: 1, kind: 'typed', now: day(2026, 3, 2) })
    const before = useProgress.getState().cards
    const raw = localStorage.getItem('zz-progress')!
    useProgress.setState(empty)
    localStorage.setItem('zz-progress', raw)
    await useProgress.persist.rehydrate()
    expect(useProgress.getState().cards).toEqual(before)
  })
})

describe('resetLanguage', () => {
  it('removes cards and log entries of one language only', () => {
    const { record } = useProgress.getState()
    const now = day(2026, 3, 2)
    record(water, Rating.Good, { ms: 1, kind: 'typed', now })
    record(recallName, Rating.Good, { ms: 1, kind: 'typed', now })
    record(waterFa, Rating.Good, { ms: 1, kind: 'typed', now })
    const faCard = useProgress.getState().cards[waterFa]

    useProgress.getState().resetLanguage('ckb')
    const s = useProgress.getState()
    expect(s.cards).toEqual({ [waterFa]: faCard })
    expect(s.log.map((e) => e.key)).toEqual([waterFa])
  })
})

describe('report', () => {
  it('appends a content report', () => {
    useProgress.getState().report(water, 'Wrong vowel in the romanization')
    expect(useProgress.getState().reports).toEqual([
      { key: water, message: 'Wrong vowel in the romanization', at: expect.any(String) },
    ])
  })
})
