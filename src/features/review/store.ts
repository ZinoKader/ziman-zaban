import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { TargetLang } from '@/content/types'
import { dayKey } from '@/store/progress'
import { composeComment, parseComment, type Decision, type IncorrectDetail, type ReviewRecord } from './export'
import { DEFAULT_FILTERS, type QueueFilters } from './queue'

interface ReviewState {
  reviewer: string
  lang: TargetLang | null
  /** Keyed by review key, e.g. `concept:ckb:water`. One decision per key; changing it overwrites. */
  decisions: Record<string, Decision>
  filters: QueueFilters
  /** Where the reviewer was, per language, to resume after a reload. */
  cursor: Partial<Record<TargetLang, string>>
  setup: (reviewer: string, lang: TargetLang) => void
  approve: (key: string, now?: Date) => void
  flag: (key: string, detail: IncorrectDetail, now?: Date) => void
  undo: (key: string) => void
  /** Merges a previously exported file. A newer local decision is kept. Returns how many entries were applied. */
  importReviews: (reviews: ReviewRecord[]) => number
  clear: (lang: TargetLang) => void
  setFilters: (patch: Partial<QueueFilters>) => void
  setCursor: (lang: TargetLang, key: string | null) => void
}

export const useReview = create<ReviewState>()(
  persist(
    (set, get) => ({
      reviewer: '',
      lang: null,
      decisions: {},
      filters: DEFAULT_FILTERS,
      cursor: {},
      setup: (reviewer, lang) => set({ reviewer: reviewer.trim(), lang }),
      approve: (key, now = new Date()) =>
        set((s) => ({
          decisions: { ...s.decisions, [key]: { verdict: 'correct', reviewer: s.reviewer, date: dayKey(now) } },
        })),
      flag: (key, detail, now = new Date()) => {
        const comment = composeComment(detail)
        if (!comment) throw new Error('An incorrect verdict needs a comment')
        set((s) => ({
          decisions: {
            ...s.decisions,
            [key]: {
              verdict: 'incorrect',
              reviewer: s.reviewer,
              date: dayKey(now),
              comment,
              issues: detail.issues,
              correctForm: detail.correctForm.trim() || undefined,
              note: detail.note.trim() || undefined,
            },
          },
        }))
      },
      undo: (key) =>
        set((s) => {
          const { [key]: _removed, ...rest } = s.decisions
          return { decisions: rest }
        }),
      importReviews: (reviews) => {
        const next = { ...get().decisions }
        let applied = 0
        for (const r of [...reviews].sort((a, b) => a.date.localeCompare(b.date))) {
          const existing = next[r.key]
          if (existing && existing.date > r.date) continue
          next[r.key] = {
            verdict: r.verdict,
            reviewer: r.reviewer,
            date: r.date,
            ...(r.comment ? { comment: r.comment, ...parseComment(r.comment) } : {}),
          }
          applied++
        }
        set({ decisions: next })
        return applied
      },
      clear: (lang) =>
        set((s) => ({
          decisions: Object.fromEntries(Object.entries(s.decisions).filter(([k]) => k.split(':')[1] !== lang)),
          cursor: { ...s.cursor, [lang]: undefined },
        })),
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      setCursor: (lang, key) => set((s) => ({ cursor: { ...s.cursor, [lang]: key ?? undefined } })),
    }),
    {
      name: 'zz-review',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ reviewer, lang, decisions, filters, cursor }) => ({ reviewer, lang, decisions, filters, cursor }),
    },
  ),
)
