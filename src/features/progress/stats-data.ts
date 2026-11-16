import { conceptById, qaById, sentenceById } from '@/content'
import { pictureById, pictureWord } from '@/content/pictures'
import type { Localized, Skill, TargetLang } from '@/content/types'
import { isLearned, parseCardKey, reviewCard, State, type CardKey, type Grade, type StoredCard } from '@/lib/srs'
import { dayKey, type DayStats, type ReviewEntry } from '@/store/progress'

export type Range = 'week' | 'month' | 'year'
export type Metric = 'answers' | 'minutes' | 'accuracy' | 'new'

export const RANGES: readonly Range[] = ['week', 'month', 'year']
export const METRICS: readonly Metric[] = ['answers', 'minutes', 'accuracy', 'new']

const DAY_MS = 86_400_000
export const SESSION_GAP_MS = 30 * 60_000

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isDayKey(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayKey(parseDay(v)) === v
}

export function addDaysTo(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Weeks start on Monday. */
export function startOfWeek(d: Date): Date {
  return addDaysTo(d, -((d.getDay() + 6) % 7))
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

export interface Period {
  range: Range
  start: Date
  /** Exclusive. */
  end: Date
}

export function periodOf(range: Range, anchor: Date): Period {
  if (range === 'week') {
    const start = startOfWeek(anchor)
    return { range, start, end: addDaysTo(start, 7) }
  }
  if (range === 'month') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    return { range, start, end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) }
  }
  const start = new Date(anchor.getFullYear(), 0, 1)
  return { range, start, end: new Date(anchor.getFullYear() + 1, 0, 1) }
}

/** The same kind of period, `step` periods before (negative) or after (positive). */
export function shiftPeriod(p: Period, step: number): Period {
  if (p.range === 'week') return periodOf('week', addDaysTo(p.start, 7 * step))
  if (p.range === 'month') return periodOf('month', new Date(p.start.getFullYear(), p.start.getMonth() + step, 1))
  return periodOf('year', new Date(p.start.getFullYear() + step, 0, 1))
}

export function contains(p: Period, d: Date): boolean {
  return d >= p.start && d < p.end
}

export interface Totals {
  reviews: number
  correct: number
  ms: number
  newItems: number
  activeDays: number
}

const NO_TOTALS: Totals = { reviews: 0, correct: 0, ms: 0, newItems: 0, activeDays: 0 }

export function totalsBetween(days: Record<string, DayStats>, start: Date, end: Date): Totals {
  const t = { ...NO_TOTALS }
  for (let d = start; d < end; d = addDaysTo(d, 1)) {
    const s = days[dayKey(d)]
    if (!s?.reviews) continue
    t.reviews += s.reviews
    t.correct += s.correct
    t.ms += s.ms
    t.newItems += s.newItems
    t.activeDays++
  }
  return t
}

export function accuracyOf(t: Pick<Totals, 'reviews' | 'correct'>): number | null {
  return t.reviews ? Math.round((t.correct / t.reviews) * 100) : null
}

export function metricValue(t: Totals, metric: Metric): number | null {
  if (metric === 'answers') return t.reviews
  if (metric === 'minutes') return Math.round(t.ms / 60_000)
  if (metric === 'new') return t.newItems
  return accuracyOf(t)
}

export interface Bucket extends Totals {
  key: string
  start: Date
  end: Date
  wrong: number
}

/** One bucket per day for a week or month, one per month for a year. */
export function bucketsOf(p: Period, days: Record<string, DayStats>): Bucket[] {
  const out: Bucket[] = []
  if (p.range === 'year') {
    for (let m = 0; m < 12; m++) {
      const start = new Date(p.start.getFullYear(), m, 1)
      const end = new Date(p.start.getFullYear(), m + 1, 1)
      const t = totalsBetween(days, start, end)
      out.push({ key: dayKey(start).slice(0, 7), start, end, ...t, wrong: t.reviews - t.correct })
    }
    return out
  }
  for (let d = p.start; d < p.end; d = addDaysTo(d, 1)) {
    const end = addDaysTo(d, 1)
    const t = totalsBetween(days, d, end)
    out.push({ key: dayKey(d), start: d, end, ...t, wrong: t.reviews - t.correct })
  }
  return out
}

/** Relative change from `before` to `now` in percent, or null when there is nothing to compare with. */
export function change(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before === 0) return null
  return Math.round(((now - before) / before) * 100)
}

export interface Answer {
  key: CardKey
  lang: TargetLang
  skill: Skill
  itemId: string
  grade: Grade
  at: Date
  ms: number
  kind: string
  correct: boolean
  /** The first answer ever given for this card. */
  isNew: boolean
}

/** The review log as answers, oldest first, limited to `langs`. */
export function answersOf(log: readonly ReviewEntry[], langs: readonly TargetLang[]): Answer[] {
  const seen = new Set<CardKey>()
  return [...log]
    .sort((a, b) => a.at.localeCompare(b.at))
    .flatMap((e) => {
      const { lang, skill, itemId } = parseCardKey(e.key)
      const isNew = !seen.has(e.key)
      seen.add(e.key)
      if (!langs.includes(lang)) return []
      return [{ key: e.key, lang, skill, itemId, grade: e.grade, at: new Date(e.at), ms: e.ms, kind: e.kind, correct: e.grade > 1, isNew }]
    })
}

export function answersBetween(answers: readonly Answer[], start: Date, end: Date): Answer[] {
  return answers.filter((a) => a.at >= start && a.at < end)
}

export interface Session {
  start: Date
  end: Date
  answers: Answer[]
  correct: number
  newItems: number
  skills: Skill[]
}

/** Answers grouped into sessions: a pause of more than half an hour starts a new one. */
export function sessionsOf(answers: readonly Answer[], gapMs = SESSION_GAP_MS): Session[] {
  const out: Session[] = []
  for (const a of answers) {
    const last = out.at(-1)
    if (last && a.at.getTime() - last.end.getTime() <= gapMs) {
      last.answers.push(a)
      last.end = a.at
    } else {
      out.push({ start: a.at, end: a.at, answers: [a], correct: 0, newItems: 0, skills: [] })
    }
  }
  for (const s of out) {
    s.correct = s.answers.filter((a) => a.correct).length
    s.newItems = s.answers.filter((a) => a.isNew).length
    s.skills = [...new Set(s.answers.map((a) => a.skill))]
  }
  return out
}

export interface SkillShare {
  skill: Skill
  reviews: number
  correct: number
}

export function bySkill(answers: readonly Answer[], order: readonly Skill[]): SkillShare[] {
  return order
    .map((skill) => {
      const mine = answers.filter((a) => a.skill === skill)
      return { skill, reviews: mine.length, correct: mine.filter((a) => a.correct).length }
    })
    .filter((s) => s.reviews > 0)
}

/** Answers per weekday (Monday first) and hour of the day. */
export function punchCard(answers: readonly Answer[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const a of answers) grid[weekdayIndex(a.at)][a.at.getHours()]++
  return grid
}

export function busiest(grid: number[][]): { weekday: number; hour: number; count: number } | null {
  let best = { weekday: 0, hour: 0, count: 0 }
  for (let w = 0; w < grid.length; w++) {
    for (let h = 0; h < grid[w].length; h++) if (grid[w][h] > best.count) best = { weekday: w, hour: h, count: grid[w][h] }
  }
  return best.count ? best : null
}

export interface WordsPoint {
  day: string
  date: Date
  met: number
  learned: number
}

/**
 * Words met and learned so far, per day from the first answer to `until`. The cards are replayed
 * from the log, so a word counts as learned on the day its Recognition or Recall card first
 * graduated, as on the course bar.
 */
export function wordsOverTime(answers: readonly Answer[], until: Date): WordsPoint[] {
  const cards = new Map<CardKey, StoredCard>()
  const met = new Map<string, string>()
  const learned = new Map<string, string>()
  for (const a of answers) {
    const card = reviewCard(cards.get(a.key), a.grade, a.at)
    cards.set(a.key, card)
    if (a.skill !== 'recognition' && a.skill !== 'recall') continue
    const word = `${a.lang}:${a.itemId}`
    const day = dayKey(a.at)
    if (!met.has(word)) met.set(word, day)
    if (!learned.has(word) && isLearned(card)) learned.set(word, day)
  }
  if (!answers.length) return []
  const perDay = (m: Map<string, string>) => {
    const counts = new Map<string, number>()
    for (const d of m.values()) counts.set(d, (counts.get(d) ?? 0) + 1)
    return counts
  }
  const metPerDay = perDay(met)
  const learnedPerDay = perDay(learned)
  const out: WordsPoint[] = []
  let m = 0
  let l = 0
  const last = new Date(until.getFullYear(), until.getMonth(), until.getDate())
  for (let d = parseDay(dayKey(answers[0].at)); d <= last; d = addDaysTo(d, 1)) {
    const key = dayKey(d)
    m += metPerDay.get(key) ?? 0
    l += learnedPerDay.get(key) ?? 0
    out.push({ day: key, date: d, met: m, learned: l })
  }
  return out
}

/**
 * Word answers since `since` given on a card that had already left the learning steps,
 * i.e. real spaced reviews, and how many were right. The scheduler aims for 90 %.
 */
export function reviewRecall(answers: readonly Answer[], since: Date): { reviews: number; correct: number } {
  const cards = new Map<CardKey, StoredCard>()
  const out = { reviews: 0, correct: 0 }
  for (const a of answers) {
    const before = cards.get(a.key)
    cards.set(a.key, reviewCard(before, a.grade, a.at))
    if (a.at < since || (a.skill !== 'recognition' && a.skill !== 'recall')) continue
    if (before?.state !== State.Review) continue
    out.reviews++
    if (a.correct) out.correct++
  }
  return out
}

export interface Records {
  bestDay: { day: string; reviews: number } | null
  bestWeek: { start: string; reviews: number } | null
  longestStreak: { days: number; start: string; end: string } | null
  firstDay: string | null
  total: Totals
}

export function recordsOf(days: Record<string, DayStats>): Records {
  const active = Object.keys(days)
    .filter((k) => days[k].reviews > 0)
    .sort()
  if (!active.length) return { bestDay: null, bestWeek: null, longestStreak: null, firstDay: null, total: { ...NO_TOTALS } }
  const total = { ...NO_TOTALS }
  let bestDay = { day: active[0], reviews: 0 }
  const weeks = new Map<string, number>()
  let streak = { days: 0, start: active[0], end: active[0] }
  let run = { days: 0, start: active[0], end: active[0] }
  let prev: Date | null = null
  for (const k of active) {
    const s = days[k]
    total.reviews += s.reviews
    total.correct += s.correct
    total.ms += s.ms
    total.newItems += s.newItems
    total.activeDays++
    if (s.reviews > bestDay.reviews) bestDay = { day: k, reviews: s.reviews }
    const d = parseDay(k)
    const week = dayKey(startOfWeek(d))
    weeks.set(week, (weeks.get(week) ?? 0) + s.reviews)
    run = prev && dayKey(addDaysTo(prev, 1)) === k ? { ...run, days: run.days + 1, end: k } : { days: 1, start: k, end: k }
    if (run.days > streak.days) streak = run
    prev = d
  }
  const [start, reviews] = [...weeks.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))
  return { bestDay, bestWeek: { start, reviews }, longestStreak: streak, firstDay: active[0], total }
}

export interface HeatCell {
  day: string
  date: Date
  reviews: number
  correct: number
  level: 0 | 1 | 2 | 3 | 4
  future: boolean
}

/** `weeks` columns of seven days (Monday on top), the last column holding `today`. */
export function heatmapOf(days: Record<string, DayStats>, today: Date, weeks = 53): HeatCell[][] {
  const first = addDaysTo(startOfWeek(today), -7 * (weeks - 1))
  let max = 0
  for (let d = first; d <= today; d = addDaysTo(d, 1)) max = Math.max(max, days[dayKey(d)]?.reviews ?? 0)
  const level = (r: number) => (r ? Math.min(4, Math.ceil((4 * r) / max)) : 0) as HeatCell['level']
  const end = today.getTime()
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDaysTo(first, w * 7 + i)
      const key = dayKey(date)
      const s = days[key]
      return { day: key, date, reviews: s?.reviews ?? 0, correct: s?.correct ?? 0, level: level(s?.reviews ?? 0), future: date.getTime() > end }
    }),
  )
}

export interface ItemLabel {
  target?: { script: string; latin: string }
  meaning?: Localized
}

/** What an answer was about: the Sorani or Persian form and its meaning. */
export function itemLabel(skill: Skill, itemId: string, lang: TargetLang): ItemLabel {
  if (skill === 'recognition' || skill === 'recall') {
    const c = conceptById.get(itemId)
    const form = c?.[lang]?.primary
    return { target: form && { script: form.script, latin: form.latin }, meaning: c?.gloss }
  }
  if (skill === 'construction') {
    const s = sentenceById.get(itemId)
    const form = s?.[lang]
    return { target: form && { script: form.text, latin: form.latin }, meaning: s?.translation }
  }
  if (skill === 'response') {
    const q = qaById.get(itemId)
    const form = q?.[lang]?.question
    return { target: form && { script: form.text, latin: form.latin }, meaning: q?.question }
  }
  const p = pictureById.get(itemId)
  const w = p && pictureWord(p, lang)
  return { target: w ? { script: w.entry.primary.script, latin: w.entry.primary.latin } : undefined, meaning: w?.gloss }
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}
