import { queryOptions, useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { TargetLang } from '@/content/types'
import * as api from '@/data/progress-api'
import { queryClient } from '@/data/query-client'
import { cardInsert, medalInserts, progressRows, reportInsert, reviewInsert, type FullProgress } from '@/data/rows'
import {
  EMPTY_PROGRESS,
  withMedals,
  withReport,
  withReview,
  withoutLanguage,
  type Progress,
} from '@/lib/progress'
import type { CardKey, Grade, StoredCard } from '@/lib/srs'

export * from '@/lib/progress'

export const PROGRESS_KEY = ['progress'] as const
const SAVE_SCOPE = { id: 'progress' }

let edits = 0

async function loadProgress(): Promise<Progress> {
  const before = edits
  const fresh = await api.fetchProgress()
  const busy = edits !== before || queryClient.isMutating({ mutationKey: PROGRESS_KEY }) > 0
  return busy ? getProgress() : fresh
}

export const progressQuery = queryOptions({ queryKey: PROGRESS_KEY, queryFn: loadProgress })

queryClient.setQueryDefaults(PROGRESS_KEY, { queryFn: loadProgress })

export function getProgress(): Progress {
  return queryClient.getQueryData<Progress>(PROGRESS_KEY) ?? EMPTY_PROGRESS
}

export function setProgress(update: Progress | ((p: Progress) => Progress)) {
  edits++
  queryClient.setQueryData<Progress>(PROGRESS_KEY, (p = EMPTY_PROGRESS) => (typeof update === 'function' ? update(p) : update))
}

export function useProgress<T>(select: (p: Progress) => T): T {
  return useSuspenseQuery({ ...progressQuery, select }, queryClient).data
}

export function reloadProgress() {
  return queryClient.resetQueries({ queryKey: PROGRESS_KEY })
}

function useSave<V>(save: (v: V) => Promise<void>) {
  return useMutation({ mutationKey: PROGRESS_KEY, scope: SAVE_SCOPE, mutationFn: (v: V) => save(v) }, queryClient)
}

interface JournalEntry {
  key: CardKey
  prev: StoredCard | undefined
  at: number
}

const MAX_JOURNAL = 1000
const journal: JournalEntry[] = []

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

export type RecordReview = (key: CardKey, grade: Grade, meta: { ms: number; kind: string; now?: Date }) => StoredCard

export function useRecordReview(): RecordReview {
  const { mutate } = useSave(api.saveProgress)
  return useCallback(
    (key, grade, { ms, kind, now = new Date() }) => {
      const current = getProgress()
      const { progress, card, entry } = withReview(current, key, grade, { ms, kind, now })
      journal.push({ key, prev: current.cards[key], at: now.getTime() })
      if (journal.length > MAX_JOURNAL) journal.splice(0, journal.length - MAX_JOURNAL)
      setProgress(progress)
      mutate({ reviews: [reviewInsert(entry, card)], cards: [cardInsert(key, card)] })
      return card
    },
    [mutate],
  )
}

export function useAwardMedals() {
  const { mutate } = useSave(api.saveMedals)
  return useCallback(
    (lang: TargetLang, words: number[], now = new Date()) => {
      const { progress, fresh } = withMedals(getProgress(), lang, words, now)
      if (!fresh.length) return
      setProgress(progress)
      mutate(medalInserts(lang, fresh))
    },
    [mutate],
  )
}

export function useReportProblem() {
  const { mutate } = useSave(api.saveReport)
  return useCallback(
    (key: string, message: string, now = new Date()) => {
      const { progress, report } = withReport(getProgress(), key, message, now)
      setProgress(progress)
      mutate(reportInsert(report))
    },
    [mutate],
  )
}

export function useResetLanguage() {
  const { mutate } = useSave(({ lang, at }: { lang: TargetLang; at: string }) => api.resetLanguage(lang, at))
  return useCallback(
    (lang: TargetLang, now = new Date()) => {
      setProgress((p) => withoutLanguage(p, lang))
      mutate({ lang, at: now.toISOString() })
    },
    [mutate],
  )
}

export function useImportBackup() {
  const { mutateAsync } = useSave(api.saveProgress)
  return useCallback(
    async (backup: FullProgress, fallback: TargetLang) => {
      await mutateAsync(progressRows(backup, fallback))
      await queryClient.refetchQueries({ queryKey: PROGRESS_KEY })
    },
    [mutateAsync],
  )
}
