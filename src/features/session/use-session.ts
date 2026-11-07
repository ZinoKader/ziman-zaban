import { useState } from 'react'
import type { Skill, TargetLang } from '@/content/types'
import { buildQueue, type Candidate, type Cards } from '@/lib/curriculum'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'

/** What the next session holds: reviews and new items mixed (the default), only new items, or only reviews. */
export type SessionKind = 'mixed' | 'new' | 'reviews'

export interface QueueSettings {
  sessionSize: number
  newPerSession: number
  units?: string[]
}

export function queueFor(skill: Skill, lang: TargetLang, cards: Cards, kind: SessionKind, q: QueueSettings): Candidate[] {
  return buildQueue(skill, lang, cards, {
    size: q.sessionSize,
    maxNew: kind === 'reviews' ? 0 : q.newPerSession,
    units: q.units,
    onlyNew: kind === 'new',
  })
}

/**
 * Builds a queue once when a session starts (so cards changing mid-session don't
 * reshuffle it) and rebuilds on restart.
 */
export function useSessionQueue(skill: Skill, lang: TargetLang, options: { units?: string[]; kind?: SessionKind } = {}) {
  const sessionSize = useSettings((s) => s.sessionSize)
  const newPerSession = useSettings((s) => s.newPerSession)
  const build = (kind: SessionKind) =>
    queueFor(skill, lang, useProgress.getState().cards, kind, { sessionSize, newPerSession, units: options.units })
  const [queue, setQueue] = useState<Candidate[]>(() => build(options.kind ?? 'mixed'))
  const [generation, setGeneration] = useState(0)
  return {
    queue,
    generation,
    restart: (kind: SessionKind = 'mixed') => {
      setQueue(build(kind))
      setGeneration((g) => g + 1)
    },
  }
}
