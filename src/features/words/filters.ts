import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { evidenceFor, type EvidenceLevel } from '@/content'
import type { Concept, PartOfSpeech, TargetLang } from '@/content/types'
import type { CardKey, StoredCard, Strength } from '@/lib/srs'
import type { WordMatch } from './search-index'
import { wordStrength } from './word-progress'

export interface WordFilters {
  q: string
  unit: string
  pos: '' | PartOfSpeech
  progress: '' | Strength
  evidence: '' | EvidenceLevel
}

const KEYS = ['q', 'unit', 'pos', 'progress', 'evidence'] as const

export const EMPTY_FILTERS: WordFilters = { q: '', unit: '', pos: '', progress: '', evidence: '' }

export function hasActiveFilters(f: WordFilters): boolean {
  return !!(f.unit || f.pos || f.progress || f.evidence)
}

export function applyFilters(
  matches: WordMatch[],
  f: WordFilters,
  lang: TargetLang,
  cards: Partial<Record<CardKey, StoredCard>>,
): Concept[] {
  return matches
    .map((m) => m.concept)
    .filter(
      (c) =>
        (!f.unit || c.unit === f.unit) &&
        (!f.pos || c.pos === f.pos) &&
        (!f.progress || wordStrength(cards, lang, c.id).overall === f.progress) &&
        (!f.evidence || evidenceFor('concept', lang, c.id).level === f.evidence),
    )
}

/** Filter state mirrored into the URL, so it survives opening a word and sharing a link. */
export function useWordFilters() {
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<WordFilters>(() => {
    const f = { ...EMPTY_FILTERS }
    for (const k of KEYS) (f as Record<string, string>)[k] = params.get(k) ?? ''
    return f
  })

  useEffect(() => {
    const next = new URLSearchParams()
    for (const k of KEYS) if (filters[k]) next.set(k, filters[k])
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [filters, params, setParams])

  const update = (patch: Partial<WordFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const clear = () => setFilters((f) => ({ ...EMPTY_FILTERS, q: f.q }))
  return { filters, update, clear, search: params.toString() ? `?${params}` : '' }
}
