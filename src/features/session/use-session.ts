import { useState } from 'react'
import type { Skill, TargetLang } from '@/content/types'
import { buildQueue, type Candidate } from '@/lib/curriculum'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'

/**
 * Builds a queue once when a session starts (so cards changing mid-session don't
 * reshuffle it) and rebuilds on restart.
 */
export function useSessionQueue(skill: Skill, lang: TargetLang, options: { units?: string[]; maxNew?: number } = {}) {
  const sessionSize = useSettings((s) => s.sessionSize)
  const newPerSession = useSettings((s) => s.newPerSession)
  const build = () =>
    buildQueue(skill, lang, useProgress.getState().cards, {
      size: sessionSize,
      maxNew: options.maxNew ?? newPerSession,
      units: options.units,
    })
  const [queue, setQueue] = useState<Candidate[]>(build)
  const [generation, setGeneration] = useState(0)
  return {
    queue,
    generation,
    restart: () => {
      setQueue(build())
      setGeneration((g) => g + 1)
    },
  }
}
