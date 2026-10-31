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

interface ProgressState {
  cards: Partial<Record<CardKey, StoredCard>>
  log: ReviewEntry[]
  days: Record<string, DayStats>
  reports: ContentReport[]
  record: (key: CardKey, grade: Grade, meta: { ms: number; kind: string; now?: Date }) => StoredCard
  report: (key: string, message: string) => void
  resetLanguage: (lang: TargetLang) => void
  importState: (s: Pick<ProgressState, 'cards' | 'log' | 'days'>) => void
}

const MAX_LOG = 5000

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
      reports: [],
      record: (key, grade, { ms, kind, now = new Date() }) => {
        const prev = get().cards[key]
        const card = reviewCard(prev, grade, now)
        const day = dayKey(now)
        journal.push({ key, prev, at: now.getTime() })
        if (journal.length > MAX_JOURNAL) journal.splice(0, journal.length - MAX_JOURNAL)
        set((s) => {
          const d = s.days[day] ?? { reviews: 0, correct: 0, newItems: 0, ms: 0 }
          return {
            cards: { ...s.cards, [key]: card },
            log: [...s.log, { key, grade, at: now.toISOString(), ms, kind }].slice(-MAX_LOG),
            days: {
              ...s.days,
              [day]: {
                reviews: d.reviews + 1,
                correct: d.correct + (grade > 1 ? 1 : 0),
                newItems: d.newItems + (prev ? 0 : 1),
                ms: d.ms + Math.min(ms, 120_000),
              },
            },
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
        })),
      importState: ({ cards, log, days }) => set({ cards, log, days }),
    }),
    {
      name: 'zz-progress',
      version: 1,
      storage: createJSONStorage(() => deviceStorage),
    },
  ),
)

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
