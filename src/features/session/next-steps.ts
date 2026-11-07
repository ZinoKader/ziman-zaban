import type { Skill, TargetLang } from '@/content/types'
import { moduleStatus, type Cards } from '@/lib/curriculum'
import { MODULES } from '@/features/modules'
import { queueFor, type QueueSettings } from './use-session'

export interface NextSteps {
  /** New items to suggest: in this module if it has any, else the first module (in course order) that does. */
  learnNew: { skill: Skill; count: number } | null
  /** Reviews left in this module. */
  reviews: number
  /** Another module with reviews due, to continue with. */
  other: Skill | null
}

/** What to offer when a session ends, so the app suggests more rather than stopping. */
export function nextSteps(skill: Skill, lang: TargetLang, cards: Cards, q: QueueSettings, now = new Date()): NextSteps {
  const here = queueFor(skill, lang, cards, 'new', q).length
  const reviews = queueFor(skill, lang, cards, 'reviews', q).length
  const others = MODULES.filter((m) => m.skill !== skill).map((m) => ({ skill: m.skill, status: moduleStatus(m.skill, lang, cards, now) }))
  const elsewhere = others.find((m) => m.status.available > 0)
  const learnNew = here
    ? { skill, count: here }
    : elsewhere
      ? { skill: elsewhere.skill, count: Math.min(elsewhere.status.available, q.newPerSession) }
      : null
  const other = others.find((m) => m.status.due > 0)?.skill ?? null
  return { learnNew, reviews, other }
}
