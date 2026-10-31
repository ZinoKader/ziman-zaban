import { useEffect, useRef, useState } from 'react'
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

function fromParams(params: URLSearchParams): WordFilters {
  const f = { ...EMPTY_FILTERS }
  for (const k of KEYS) (f as Record<string, string>)[k] = params.get(k) ?? ''
  return f
}

function toParams(f: WordFilters): URLSearchParams {
  const next = new URLSearchParams()
  for (const k of KEYS) if (f[k]) next.set(k, f[k])
  return next
}

/**
 * Filter state mirrored into the URL, so it survives opening a word and sharing a link.
 * Filters live in local state so typing stays instant (URL updates land in a transition);
 * a URL change that didn't come from here (Back, the Words link in the menu) replaces them.
 */
export function useWordFilters() {
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<WordFilters>(() => fromParams(params))
  /** Searches written by `apply` that the router hasn't reported back yet, oldest first. */
  const written = useRef<string[]>([params.toString()])
  const search = params.toString()

  useEffect(() => {
    const i = written.current.indexOf(search)
    if (i >= 0) {
      written.current = written.current.slice(i + 1)
      return
    }
    written.current = []
    setFilters(fromParams(new URLSearchParams(search)))
  }, [search])

  const apply = (next: WordFilters) => {
    setFilters(next)
    const nextSearch = toParams(next).toString()
    if (nextSearch === (written.current.at(-1) ?? search)) return
    written.current.push(nextSearch)
    setParams(toParams(next), { replace: true })
  }
  const update = (patch: Partial<WordFilters>) => apply({ ...filters, ...patch })
  const clear = () => apply({ ...EMPTY_FILTERS, q: filters.q })
  return { filters, update, clear, search: search ? `?${search}` : '' }
}
