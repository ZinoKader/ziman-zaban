import { cardKey, Rating, reviewCard, State, type CardKey, type Grade } from '@/lib/srs'
import {
  dayKey,
  daysByLangFromLog,
  EMPTY_PROGRESS,
  scopedDays,
  streak,
  totalDays,
  withMedals,
  withoutLanguage,
  withReport,
  withReview,
  type DayStats,
  type Progress,
  type ReviewEntry,
} from './progress'

const water = cardKey('ckb', 'recognition', 'water')
const waterFa = cardKey('fa', 'recognition', 'water')
const recallName = cardKey('ckb', 'recall', 'name')

const day = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

function play(steps: [CardKey, Grade, Date, number?][], start: Progress = EMPTY_PROGRESS) {
  const log: ReviewEntry[] = []
  let p = start
  for (const [key, grade, now, ms = 1] of steps) {
    const r = withReview(p, key, grade, { ms, kind: 'typed', now })
    p = r.progress
    log.push(r.entry)
  }
  return { p, log }
}

describe('dayKey', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(dayKey(day(2026, 1, 5))).toBe('2026-01-05')
    expect(dayKey(day(2026, 12, 31, 23, 59))).toBe('2026-12-31')
    expect(dayKey(day(2027, 1, 1, 0, 1))).toBe('2027-01-01')
  })
})

describe('withReview', () => {
  it('creates a card, an entry and day stats for a new item', () => {
    const now = day(2026, 3, 2, 9)
    const { progress, card, entry } = withReview(EMPTY_PROGRESS, water, Rating.Good, { ms: 3200, kind: 'mc-meaning', now })
    expect(progress.cards[water]).toEqual(card)
    expect(card).toEqual(reviewCard(undefined, Rating.Good, now))
    expect(entry).toEqual({ key: water, grade: Rating.Good, at: now.toISOString(), ms: 3200, kind: 'mc-meaning' })
    expect(progress.days[dayKey(now)]).toEqual({ reviews: 1, correct: 1, newItems: 1, ms: 3200 })
    expect(EMPTY_PROGRESS.cards).toEqual({})
  })

  it('updates the same card on later reviews and only counts it as new once', () => {
    const { p } = play([
      [water, Rating.Good, day(2026, 3, 2, 9)],
      [water, Rating.Good, day(2026, 3, 2, 10)],
    ])
    expect(p.cards[water]!.reps).toBe(2)
    expect(p.cards[water]!.createdAt).toBe(day(2026, 3, 2, 9).toISOString())
    expect(p.cards[water]!.state).toBe(State.Review)
    expect(p.days['2026-03-02']).toMatchObject({ reviews: 2, newItems: 1 })
  })

  it('counts Again as not correct and lapses the card', () => {
    const { p } = play([
      [water, Rating.Good, day(2026, 3, 2, 9)],
      [water, Rating.Good, day(2026, 3, 2, 10)],
    ])
    const due = new Date(p.cards[water]!.due)
    const { progress, card } = withReview(p, water, Rating.Again, { ms: 1000, kind: 'typed', now: due })
    expect(card.lapses).toBe(1)
    expect(progress.days[dayKey(due)]).toMatchObject({ reviews: 1, correct: 0, newItems: 0 })
  })

  it('caps time per review at two minutes', () => {
    const now = day(2026, 3, 2)
    const { p } = play([[water, Rating.Hard, now, 10 * 60_000]])
    expect(p.days[dayKey(now)]).toMatchObject({ ms: 120_000, correct: 1 })
  })

  it('files reviews under the local day they happened on', () => {
    const { p } = play([
      [water, Rating.Good, day(2026, 3, 2, 23, 59)],
      [recallName, Rating.Good, day(2026, 3, 3, 0, 1)],
    ])
    expect(Object.keys(p.days).sort()).toEqual(['2026-03-02', '2026-03-03'])
  })

  it('keeps day stats per language as well as for both together', () => {
    const now = day(2026, 3, 2, 9)
    const { p } = play([
      [water, Rating.Good, now, 1000],
      [recallName, Rating.Again, now, 1000],
      [waterFa, Rating.Good, now, 500],
    ])
    expect(p.days['2026-03-02']).toEqual({ reviews: 3, correct: 2, newItems: 3, ms: 2500 })
    expect(p.daysByLang.ckb!['2026-03-02']).toEqual({ reviews: 2, correct: 1, newItems: 2, ms: 2000 })
    expect(p.daysByLang.fa!['2026-03-02']).toEqual({ reviews: 1, correct: 1, newItems: 1, ms: 500 })
    expect(scopedDays(p, 'fa')).toBe(p.daysByLang.fa)
    expect(scopedDays(p, 'all')).toBe(p.days)
    expect(streak(scopedDays(p, 'fa'), now)).toBe(1)
    expect(totalDays(p.daysByLang)).toEqual(p.days)
  })

  it('has empty stats for a language never practised', () => {
    const a = scopedDays(EMPTY_PROGRESS, 'fa')
    expect(a).toEqual({})
    expect(scopedDays(EMPTY_PROGRESS, 'fa')).toBe(a)
  })
})

describe('daysByLangFromLog', () => {
  it('rebuilds the per-language stats that reviews produced', () => {
    const { p, log } = play([
      [water, Rating.Good, day(2026, 3, 2, 9), 1500],
      [waterFa, Rating.Again, day(2026, 3, 3, 9), 2500],
      [water, Rating.Good, day(2026, 3, 3, 10), 900],
    ])
    expect(daysByLangFromLog(log)).toEqual(p.daysByLang)
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

  it('works on the days that reviews produce', () => {
    const { p } = play([8, 9, 10].map((d) => [water, Rating.Good, day(2026, 3, d, 21)]))
    expect(streak(p.days, now)).toBe(3)
  })
})

describe('withoutLanguage', () => {
  it('removes cards, stats and medals of one language only', () => {
    const now = day(2026, 3, 2)
    const { p } = play([
      [water, Rating.Good, now],
      [recallName, Rating.Good, now],
      [waterFa, Rating.Good, now],
    ])
    const medalled = withMedals(withMedals(p, 'ckb', [10], now).progress, 'fa', [10], now).progress
    const s = withoutLanguage(medalled, 'ckb')
    expect(s.cards).toEqual({ [waterFa]: p.cards[waterFa] })
    expect(s.daysByLang.ckb).toBeUndefined()
    expect(s.daysByLang.fa).toEqual({ '2026-03-02': { reviews: 1, correct: 1, newItems: 1, ms: 1 } })
    expect(s.days).toEqual({ '2026-03-02': { reviews: 1, correct: 1, newItems: 1, ms: 1 } })
    expect(s.medals).toEqual({ fa: [{ words: 10, at: now.toISOString() }] })
  })
})

describe('withMedals', () => {
  it('keeps each medal once, sorted, with the day it was earned', () => {
    const first = withMedals(EMPTY_PROGRESS, 'ckb', [25, 10], day(2026, 3, 2))
    const second = withMedals(first.progress, 'ckb', [10, 50], day(2026, 3, 9))
    expect(second.fresh).toEqual([{ words: 50, at: day(2026, 3, 9).toISOString() }])
    expect(second.progress.medals.ckb).toEqual([
      { words: 10, at: day(2026, 3, 2).toISOString() },
      { words: 25, at: day(2026, 3, 2).toISOString() },
      { words: 50, at: day(2026, 3, 9).toISOString() },
    ])
    expect(second.progress.medals.fa).toBeUndefined()
  })

  it('returns the same progress when nothing is new', () => {
    const { progress } = withMedals(EMPTY_PROGRESS, 'ckb', [10], day(2026, 3, 2))
    expect(withMedals(progress, 'ckb', [10], day(2026, 3, 3)).progress).toBe(progress)
  })
})

describe('withReport', () => {
  it('appends a content report', () => {
    const now = day(2026, 3, 2)
    const { progress, report } = withReport(EMPTY_PROGRESS, water, 'Wrong vowel in the romanization', now)
    expect(report).toEqual({ key: water, message: 'Wrong vowel in the romanization', at: now.toISOString() })
    expect(progress.reports).toEqual([report])
  })
})
