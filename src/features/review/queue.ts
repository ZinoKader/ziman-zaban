import {
  conceptById,
  concepts,
  evidenceFor,
  qaById,
  qaFor,
  sentenceById,
  sentencesFor,
  unitById,
  type Evidence,
  type EvidenceLevel,
} from '@/content'
import type { Level, TargetLang } from '@/content/types'
import type { ContentReport } from '@/store/progress'
import type { Decision } from './export'

export const REVIEW_KINDS = ['concept', 'sentence', 'qa'] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]

/** The key format the content validator reads from `src/content/reviews/`. */
export type ReviewKey = `${ReviewKind}:${TargetLang}:${string}`

export function reviewKey(kind: ReviewKind, lang: TargetLang, id: string): ReviewKey {
  return `${kind}:${lang}:${id}`
}

export interface QueueItem {
  key: ReviewKey
  kind: ReviewKind
  id: string
  unit: string
  level: Level
  evidence: Evidence
}

/** Weakest evidence first: those items need a native speaker the most. */
export const EVIDENCE_RANK: Record<EvidenceLevel, number> = {
  none: 0,
  attested: 1,
  good: 2,
  strong: 3,
  'native-reviewed': 4,
}

const KIND_RANK: Record<ReviewKind, number> = { concept: 0, sentence: 1, qa: 2 }

type EvidenceLookup = (kind: ReviewKind, lang: TargetLang, id: string) => Evidence

export function sortQueue(items: QueueItem[]): QueueItem[] {
  const unitOrder = (u: string) => unitById.get(u)?.order ?? 999
  return items
    .map((item, i) => ({ item, i }))
    .sort(
      (a, b) =>
        EVIDENCE_RANK[a.item.evidence.level] - EVIDENCE_RANK[b.item.evidence.level] ||
        unitOrder(a.item.unit) - unitOrder(b.item.unit) ||
        KIND_RANK[a.item.kind] - KIND_RANK[b.item.kind] ||
        a.i - b.i,
    )
    .map(({ item }) => item)
}

/** Every concept, sentence and Q&A item that exists in `lang`, weakest evidence first. */
export function buildQueue(lang: TargetLang, lookup: EvidenceLookup = evidenceFor): QueueItem[] {
  const make = (kind: ReviewKind, x: { id: string; unit: string; level: Level }): QueueItem => ({
    key: reviewKey(kind, lang, x.id),
    kind,
    id: x.id,
    unit: x.unit,
    level: x.level,
    evidence: lookup(kind, lang, x.id),
  })
  return sortQueue([
    ...concepts.filter((c) => c[lang]).map((c) => make('concept', c)),
    ...sentencesFor(lang).map((s) => make('sentence', s)),
    ...qaFor(lang).map((q) => make('qa', q)),
  ])
}

const SKILL_KIND: Record<string, ReviewKind> = {
  recognition: 'concept',
  recall: 'concept',
  construction: 'sentence',
  response: 'qa',
}

/**
 * Learner reports use either a review key (`concept:ckb:water`) or a practice card key
 * (`ckb:recall:water`), depending on where they were filed.
 */
export function reportTarget(key: string): ReviewKey | null {
  const [a, b, ...rest] = key.split(':')
  const id = rest.join(':')
  if (!id) return null
  if ((REVIEW_KINDS as readonly string[]).includes(a) && (b === 'ckb' || b === 'fa')) return reviewKey(a as ReviewKind, b, id)
  if ((a === 'ckb' || a === 'fa') && SKILL_KIND[b]) return reviewKey(SKILL_KIND[b], a, id)
  return null
}

export function reportsByKey(reports: ContentReport[], lang: TargetLang): Map<ReviewKey, ContentReport[]> {
  const out = new Map<ReviewKey, ContentReport[]>()
  for (const r of reports) {
    const target = reportTarget(r.key)
    if (!target || target.split(':')[1] !== lang) continue
    out.set(target, [...(out.get(target) ?? []), r])
  }
  return out
}

export interface QueueFilters {
  kind: ReviewKind | 'all'
  unit: string
  level: Level | 'all'
  unreviewedOnly: boolean
}

export const DEFAULT_FILTERS: QueueFilters = { kind: 'all', unit: 'all', level: 'all', unreviewedOnly: false }

/** Applies the kind/unit/level filters; `unreviewedOnly` is handled separately because it changes as you go. */
export function matchesScope(item: QueueItem, f: QueueFilters): boolean {
  return (f.kind === 'all' || item.kind === f.kind) && (f.unit === 'all' || item.unit === f.unit) && (f.level === 'all' || item.level === f.level)
}

/** Reported items first, then the rest, each part in evidence order. */
export function orderWithReports(queue: QueueItem[], reported: Set<string>): QueueItem[] {
  return [...queue.filter((q) => reported.has(q.key)), ...queue.filter((q) => !reported.has(q.key))]
}

export interface KindStats {
  total: number
  reviewed: number
  correct: number
  incorrect: number
}

export function computeStats(queue: QueueItem[], decisions: Record<string, Decision>): Record<ReviewKind | 'all', KindStats> {
  const empty = (): KindStats => ({ total: 0, reviewed: 0, correct: 0, incorrect: 0 })
  const out = { all: empty(), concept: empty(), sentence: empty(), qa: empty() }
  for (const q of queue) {
    const d = decisions[q.key]
    for (const bucket of [out.all, out[q.kind]]) {
      bucket.total++
      if (!d) continue
      bucket.reviewed++
      bucket[d.verdict]++
    }
  }
  return out
}

/** The item's main target-language text: the word, the sentence, or the question. */
export function primaryText(item: QueueItem, lang: TargetLang): string {
  if (item.kind === 'concept') return conceptById.get(item.id)?.[lang]?.primary.script ?? ''
  if (item.kind === 'sentence') return sentenceById.get(item.id)?.[lang]?.text ?? ''
  return qaById.get(item.id)?.[lang]?.question.text ?? ''
}

/** The first item after `current` in `ordered` that passes `include`, or null at the end. */
export function nextKey(ordered: QueueItem[], current: string | null, include: (q: QueueItem) => boolean): ReviewKey | null {
  const pos = current ? ordered.findIndex((q) => q.key === current) : -1
  for (let i = pos + 1; i < ordered.length; i++) if (include(ordered[i])) return ordered[i].key
  return null
}
