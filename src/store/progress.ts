import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { TargetLang } from '@/content/types'
import { parseCardKey, reviewCard, type CardKey, type Grade, type StoredCard } from '@/lib/srs'
import { deviceStorage } from './device-storage'

export interface ReviewEntry {
  key: CardKey
  grade: Grade
  at: string
  ms: number
  /** Exercise kind, e.g. `mc-meaning`, `typed`, `tiles`. */
  kind: string
}

export interface DayStats {
  reviews: number
  correct: number
  newItems: number
  ms: number
}

/** Problems reported by the learner on a specific item, for the content team. */
export interface ContentReport {
  key: string
  at: string
  message: string
}

export type DaysByLang = Partial<Record<TargetLang, Record<string, DayStats>>>

interface ProgressState {
  cards: Partial<Record<CardKey, StoredCard>>
  log: ReviewEntry[]
  /** Both languages together; kept for days older than the review log reaches. */
  days: Record<string, DayStats>
  daysByLang: DaysByLang
  reports: ContentReport[]
  record: (key: CardKey, grade: Grade, meta: { ms: number; kind: string; now?: Date }) => StoredCard
  report: (key: string, message: string) => void
  resetLanguage: (lang: TargetLang) => void
  importState: (s: Pick<ProgressState, 'cards' | 'log' | 'days'> & { daysByLang?: DaysByLang }) => void
}

const MAX_LOG = 5000
const MAX_MS = 120_000

const EMPTY_DAY: DayStats = { reviews: 0, correct: 0, newItems: 0, ms: 0 }

function addReview(d: DayStats | undefined, grade: Grade, ms: number, isNew: boolean): DayStats {
  const prev = d ?? EMPTY_DAY
  return {
    reviews: prev.reviews + 1,
    correct: prev.correct + (grade > 1 ? 1 : 0),
    newItems: prev.newItems + (isNew ? 1 : 0),
    ms: prev.ms + Math.min(ms, MAX_MS),
  }
}

/**
 * Per-language day stats rebuilt from the review log, for progress saved before they were
 * recorded separately. Days older than the log (it keeps the last 5,000 reviews) are missing.
 */
export function daysByLangFromLog(log: ReviewEntry[]): DaysByLang {
  const out: DaysByLang = {}
  const seen = new Set<CardKey>()
  for (const e of log) {
    const lang = parseCardKey(e.key).lang
    const day = dayKey(new Date(e.at))
    const byDay = (out[lang] ??= {})
    byDay[day] = addReview(byDay[day], e.grade, e.ms, !seen.has(e.key))
    seen.add(e.key)
  }
  return out
}

export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface JournalEntry {
  key: CardKey
  /** The card before this review; undefined for a brand-new item. */
  prev: StoredCard | undefined
  at: number
}

const MAX_JOURNAL = 1000
const journal: JournalEntry[] = []

/**
 * Cards as they were before any review recorded at or after `since` (ms) in this visit.
 * Lets a session summary compare before and after without the session runner keeping a snapshot.
 */
export function cardsBefore(since: number, cards: Partial<Record<CardKey, StoredCard>>): Partial<Record<CardKey, StoredCard>> {
  const before = { ...cards }
  const seen = new Set<CardKey>()
  for (const e of journal) {
    if (e.at < since || seen.has(e.key)) continue
    seen.add(e.key)
    if (e.prev) before[e.key] = e.prev
    else delete before[e.key]
  }
  return before
}

/** Time (ms) of the most recent review recorded in this visit, or null. */
export function lastRecordedAt(): number | null {
  return journal.at(-1)?.at ?? null
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      cards: {},
      log: [],
      days: {},
      daysByLang: {},
      reports: [],
      record: (key, grade, { ms, kind, now = new Date() }) => {
        const prev = get().cards[key]
        const card = reviewCard(prev, grade, now)
        const day = dayKey(now)
        journal.push({ key, prev, at: now.getTime() })
        if (journal.length > MAX_JOURNAL) journal.splice(0, journal.length - MAX_JOURNAL)
        const lang = parseCardKey(key).lang
        set((s) => {
          const byDay = s.daysByLang[lang] ?? {}
          return {
            cards: { ...s.cards, [key]: card },
            log: [...s.log, { key, grade, at: now.toISOString(), ms, kind }].slice(-MAX_LOG),
            days: { ...s.days, [day]: addReview(s.days[day], grade, ms, !prev) },
            daysByLang: { ...s.daysByLang, [lang]: { ...byDay, [day]: addReview(byDay[day], grade, ms, !prev) } },
          }
        })
        return card
      },
      report: (key, message) =>
        set((s) => ({ reports: [...s.reports, { key, message, at: new Date().toISOString() }] })),
      resetLanguage: (lang) =>
        set((s) => ({
          cards: Object.fromEntries(
            Object.entries(s.cards).filter(([k]) => parseCardKey(k as CardKey).lang !== lang),
          ),
          log: s.log.filter((e) => parseCardKey(e.key).lang !== lang),
          daysByLang: Object.fromEntries(Object.entries(s.daysByLang).filter(([l]) => l !== lang)),
        })),
      importState: ({ cards, log, days, daysByLang }) =>
        set({ cards, log, days, daysByLang: daysByLang ?? daysByLangFromLog(log) }),
    }),
    {
      name: 'zz-progress',
      version: 2,
      storage: createJSONStorage(() => deviceStorage),
      migrate: (persisted, version) => {
        const s = persisted as Partial<ProgressState>
        if (version < 2 && !s.daysByLang) s.daysByLang = daysByLangFromLog(s.log ?? [])
        return s as ProgressState
      },
    },
  ),
)

export type StatsScope = TargetLang | 'all'

/** Day stats for one language, or for both together. */
export function scopedDays(s: Pick<ProgressState, 'days' | 'daysByLang'>, scope: StatsScope): Record<string, DayStats> {
  return scope === 'all' ? s.days : (s.daysByLang[scope] ?? NO_DAYS)
}
const NO_DAYS: Record<string, DayStats> = {}

/** Consecutive days (ending today or yesterday) with at least one review. */
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
