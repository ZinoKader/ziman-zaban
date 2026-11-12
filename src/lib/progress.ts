import { TARGET_LANGS, type TargetLang } from '@/content/types'
import { parseCardKey, reviewCard, type CardKey, type Grade, type StoredCard } from '@/lib/srs'

export interface ReviewEntry {
  key: CardKey
  grade: Grade
  at: string
  ms: number
  kind: string
}

export interface DayStats {
  reviews: number
  correct: number
  newItems: number
  ms: number
}

export interface ContentReport {
  key: string
  at: string
  message: string
}

export interface EarnedMedal {
  words: number
  at: string
}

export type DaysByLang = Partial<Record<TargetLang, Record<string, DayStats>>>
export type MedalsByLang = Partial<Record<TargetLang, EarnedMedal[]>>
export type StatsScope = TargetLang | 'all'

export interface Progress {
  cards: Partial<Record<CardKey, StoredCard>>
  days: Record<string, DayStats>
  daysByLang: DaysByLang
  reports: ContentReport[]
  medals: MedalsByLang
}

export const EMPTY_PROGRESS: Progress = { cards: {}, days: {}, daysByLang: {}, reports: [], medals: {} }

export const MAX_REVIEW_MS = 120_000

const NO_DAY: DayStats = { reviews: 0, correct: 0, newItems: 0, ms: 0 }
const NO_DAYS: Record<string, DayStats> = {}

export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(a: DayStats | undefined, b: DayStats): DayStats {
  const prev = a ?? NO_DAY
  return { reviews: prev.reviews + b.reviews, correct: prev.correct + b.correct, newItems: prev.newItems + b.newItems, ms: prev.ms + b.ms }
}

function reviewDay(grade: Grade, ms: number, isNew: boolean): DayStats {
  return { reviews: 1, correct: grade > 1 ? 1 : 0, newItems: isNew ? 1 : 0, ms: Math.min(ms, MAX_REVIEW_MS) }
}

export function totalDays(daysByLang: DaysByLang): Record<string, DayStats> {
  const out: Record<string, DayStats> = {}
  for (const lang of TARGET_LANGS) {
    for (const [day, d] of Object.entries(daysByLang[lang] ?? {})) out[day] = addDays(out[day], d)
  }
  return out
}

export function daysByLangFromLog(log: ReviewEntry[]): DaysByLang {
  const out: DaysByLang = {}
  const seen = new Set<CardKey>()
  for (const e of log) {
    const byDay = (out[parseCardKey(e.key).lang] ??= {})
    const day = dayKey(new Date(e.at))
    byDay[day] = addDays(byDay[day], reviewDay(e.grade, e.ms, !seen.has(e.key)))
    seen.add(e.key)
  }
  return out
}

export interface Reviewed {
  progress: Progress
  card: StoredCard
  entry: ReviewEntry
}

export function withReview(
  p: Progress,
  key: CardKey,
  grade: Grade,
  { ms, kind, now }: { ms: number; kind: string; now: Date },
): Reviewed {
  const prev = p.cards[key]
  const card = reviewCard(prev, grade, now)
  const lang = parseCardKey(key).lang
  const day = dayKey(now)
  const stats = reviewDay(grade, ms, !prev)
  const byDay = p.daysByLang[lang] ?? {}
  return {
    progress: {
      ...p,
      cards: { ...p.cards, [key]: card },
      days: { ...p.days, [day]: addDays(p.days[day], stats) },
      daysByLang: { ...p.daysByLang, [lang]: { ...byDay, [day]: addDays(byDay[day], stats) } },
    },
    card,
    entry: { key, grade, at: now.toISOString(), ms, kind },
  }
}

export function withMedals(p: Progress, lang: TargetLang, words: number[], now: Date): { progress: Progress; fresh: EarnedMedal[] } {
  const have = p.medals[lang] ?? []
  const at = now.toISOString()
  const fresh = words.filter((w) => !have.some((m) => m.words === w)).map((w) => ({ words: w, at }))
  if (!fresh.length) return { progress: p, fresh }
  const medals = [...have, ...fresh].sort((a, b) => a.words - b.words)
  return { progress: { ...p, medals: { ...p.medals, [lang]: medals } }, fresh }
}

export function withReport(p: Progress, key: string, message: string, now: Date): { progress: Progress; report: ContentReport } {
  const report = { key, message, at: now.toISOString() }
  return { progress: { ...p, reports: [...p.reports, report] }, report }
}

export function withoutLanguage(p: Progress, lang: TargetLang): Progress {
  const daysByLang = { ...p.daysByLang }
  delete daysByLang[lang]
  const medals = { ...p.medals }
  delete medals[lang]
  return {
    ...p,
    cards: Object.fromEntries(Object.entries(p.cards).filter(([k]) => parseCardKey(k as CardKey).lang !== lang)),
    days: totalDays(daysByLang),
    daysByLang,
    medals,
  }
}

export function scopedDays(p: Pick<Progress, 'days' | 'daysByLang'>, scope: StatsScope): Record<string, DayStats> {
  return scope === 'all' ? p.days : (p.daysByLang[scope] ?? NO_DAYS)
}

export function streak(days: Record<string, DayStats>, now = new Date()): number {
  let n = 0
  const d = new Date(now)
  if (!days[dayKey(d)]?.reviews) d.setDate(d.getDate() - 1)
  while (days[dayKey(d)]?.reviews) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}
