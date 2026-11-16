import { conceptsFor } from '@/content'
import { cardKey, Rating } from '@/lib/srs'
import { dayKey, type DayStats, type ReviewEntry } from '@/store/progress'
import {
  answersOf,
  bucketsOf,
  busiest,
  bySkill,
  change,
  heatmapOf,
  isDayKey,
  itemLabel,
  parseDay,
  periodOf,
  punchCard,
  recordsOf,
  reviewRecall,
  sessionsOf,
  shiftPeriod,
  totalsBetween,
  wordsOverTime,
} from './stats-data'

const day = (reviews: number, correct = reviews, ms = 0): DayStats => ({ reviews, correct, newItems: 0, ms })
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString()
const words = conceptsFor('ckb')

describe('periods', () => {
  it('starts weeks on Monday and steps across month and year ends', () => {
    const week = periodOf('week', parseDay('2026-01-01'))
    expect(dayKey(week.start)).toBe('2025-12-29')
    expect(dayKey(week.end)).toBe('2026-01-05')
    expect(dayKey(shiftPeriod(week, -1).start)).toBe('2025-12-22')
    const month = periodOf('month', parseDay('2026-03-31'))
    expect(dayKey(shiftPeriod(month, -1).start)).toBe('2026-02-01')
    expect(dayKey(shiftPeriod(month, 1).end)).toBe('2026-05-01')
    expect(dayKey(shiftPeriod(periodOf('year', parseDay('2026-06-01')), -1).start)).toBe('2025-01-01')
  })

  it('accepts only real dates as day keys', () => {
    expect(isDayKey('2026-02-28')).toBe(true)
    expect(isDayKey('2026-02-30')).toBe(false)
    expect(isDayKey('yesterday')).toBe(false)
    expect(isDayKey(null)).toBe(false)
  })
})

describe('totals and buckets', () => {
  const days = { '2026-03-02': day(10, 8, 120_000), '2026-03-08': day(5, 5), '2026-03-09': day(4, 1), '2026-01-15': day(3) }

  it('sums a period and counts the days with practice', () => {
    const week = periodOf('week', parseDay('2026-03-04'))
    expect(totalsBetween(days, week.start, week.end)).toEqual({ reviews: 15, correct: 13, ms: 120_000, newItems: 0, activeDays: 2 })
  })

  it('makes a bucket per day for a month and per month for a year', () => {
    const month = bucketsOf(periodOf('month', parseDay('2026-02-10')), days)
    expect(month).toHaveLength(28)
    const year = bucketsOf(periodOf('year', parseDay('2026-02-10')), days)
    expect(year.map((b) => b.key)).toHaveLength(12)
    expect(year[0]).toMatchObject({ key: '2026-01', reviews: 3, wrong: 0 })
    expect(year[2]).toMatchObject({ key: '2026-03', reviews: 19, correct: 14, wrong: 5, activeDays: 3 })
  })

  it('gives the change in percent, or nothing without a base', () => {
    expect(change(15, 10)).toBe(50)
    expect(change(5, 10)).toBe(-50)
    expect(change(5, 0)).toBeNull()
    expect(change(null, 3)).toBeNull()
  })
})

describe('answers and sessions', () => {
  const a = cardKey('ckb', 'recognition', words[0].id)
  const b = cardKey('ckb', 'recall', words[1].id)
  const fa = cardKey('fa', 'recognition', 'x')
  const log: ReviewEntry[] = [
    { key: a, grade: Rating.Good, at: at(2026, 3, 2, 9, 0), ms: 4000, kind: 'mc' },
    { key: b, grade: Rating.Again, at: at(2026, 3, 2, 9, 10), ms: 9000, kind: 'typed' },
    { key: a, grade: Rating.Easy, at: at(2026, 3, 2, 21, 0), ms: 2000, kind: 'mc' },
    { key: fa, grade: Rating.Good, at: at(2026, 3, 1, 8, 0), ms: 1000, kind: 'mc' },
  ]

  it('sorts the log, keeps the chosen languages and marks first answers', () => {
    const answers = answersOf(log, ['ckb'])
    expect(answers.map((x) => [x.skill, x.correct, x.isNew])).toEqual([
      ['recognition', true, true],
      ['recall', false, true],
      ['recognition', true, false],
    ])
    expect(answersOf(log, ['ckb', 'fa'])[0].lang).toBe('fa')
  })

  it('starts a new session after a pause of more than half an hour', () => {
    const sessions = sessionsOf(answersOf(log, ['ckb']))
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({ correct: 1, newItems: 2, skills: ['recognition', 'recall'] })
    expect(sessions[0].answers).toHaveLength(2)
    expect(sessions[1].answers).toHaveLength(1)
  })

  it('splits answers by module and finds the busiest hour', () => {
    const answers = answersOf(log, ['ckb'])
    expect(bySkill(answers, ['recall', 'recognition', 'pictures'])).toEqual([
      { skill: 'recall', reviews: 1, correct: 0 },
      { skill: 'recognition', reviews: 2, correct: 2 },
    ])
    const grid = punchCard(answers)
    expect(grid[0][9]).toBe(2)
    expect(busiest(grid)).toEqual({ weekday: 0, hour: 9, count: 2 })
    expect(busiest(punchCard([]))).toBeNull()
  })

  it('names what each answer was about', () => {
    expect(itemLabel('recognition', words[0].id, 'ckb')).toEqual({
      target: { script: words[0].ckb!.primary.script, latin: words[0].ckb!.primary.latin },
      meaning: words[0].gloss,
    })
    expect(itemLabel('recall', 'no-such-word', 'ckb').target).toBeUndefined()
  })

  it('counts words met and learned day by day', () => {
    const points = wordsOverTime(answersOf(log, ['ckb']), parseDay('2026-03-04'))
    expect(points.map((p) => p.day)).toEqual(['2026-03-02', '2026-03-03', '2026-03-04'])
    expect(points[0].met).toBe(2)
    expect(points.at(-1)!.met).toBe(2)
    expect(points.at(-1)!.learned).toBeLessThanOrEqual(points.at(-1)!.met)
    expect(wordsOverTime([], parseDay('2026-03-04'))).toEqual([])
  })
})

describe('records', () => {
  it('finds the best day, best week and longest streak', () => {
    const r = recordsOf({
      '2026-03-01': day(5),
      '2026-03-02': day(30, 20),
      '2026-03-03': day(2),
      '2026-03-04': day(2),
      '2026-03-10': day(20),
      '2026-03-11': day(20),
    })
    expect(r.bestDay).toEqual({ day: '2026-03-02', reviews: 30 })
    expect(r.bestWeek).toEqual({ start: '2026-03-09', reviews: 40 })
    expect(r.longestStreak).toEqual({ days: 4, start: '2026-03-01', end: '2026-03-04' })
    expect(r.firstDay).toBe('2026-03-01')
    expect(r.total).toMatchObject({ reviews: 79, correct: 69, activeDays: 6 })
  })

  it('has none before any practice', () => {
    expect(recordsOf({ '2026-03-01': day(0) })).toMatchObject({ bestDay: null, longestStreak: null, firstDay: null })
  })
})

describe('heatmap', () => {
  it('ends with the week holding today and leaves later days empty', () => {
    const today = parseDay('2026-03-04')
    const weeks = heatmapOf({ '2026-03-04': day(10), '2026-03-03': day(1), '2025-03-03': day(4) }, today)
    expect(weeks).toHaveLength(53)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks.at(-1)![0].day).toBe('2026-03-02')
    expect(weeks.at(-1)![2]).toMatchObject({ day: '2026-03-04', level: 4, future: false })
    expect(weeks.at(-1)![1].level).toBe(1)
    expect(weeks.at(-1)![3].future).toBe(true)
    expect(weeks[0][0].day).toBe('2025-03-03')
  })
})

describe('reviewRecall', () => {
  const a = cardKey('ckb', 'recognition', words[0].id)
  const c = cardKey('ckb', 'construction', 'x')
  const log: ReviewEntry[] = [
    { key: a, grade: Rating.Easy, at: at(2026, 3, 1, 9), ms: 1, kind: 'mc' },
    { key: c, grade: Rating.Easy, at: at(2026, 3, 1, 9), ms: 1, kind: 'mc' },
    { key: a, grade: Rating.Good, at: at(2026, 3, 6, 9), ms: 1, kind: 'mc' },
    { key: c, grade: Rating.Good, at: at(2026, 3, 6, 9), ms: 1, kind: 'mc' },
    { key: a, grade: Rating.Again, at: at(2026, 3, 30, 9), ms: 1, kind: 'mc' },
    { key: a, grade: Rating.Good, at: at(2026, 3, 30, 9, 10), ms: 1, kind: 'mc' },
  ]

  it('counts only word answers on cards already in spaced review', () => {
    const answers = answersOf(log, ['ckb'])
    expect(reviewRecall(answers, new Date(2026, 2, 2))).toEqual({ reviews: 2, correct: 1 })
    expect(reviewRecall(answers, new Date(2026, 2, 10))).toEqual({ reviews: 1, correct: 0 })
  })
})
