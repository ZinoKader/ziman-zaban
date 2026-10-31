import { conceptById, conceptsFor, units } from '@/content'
import type { Concept, Skill, TargetLang, Unit } from '@/content/types'
import { moduleItems, moduleStatus, type Cards, type ModuleStatus } from '@/lib/curriculum'
import { cardKey, isLearned, parseCardKey, type CardKey } from '@/lib/srs'
import { MODULES } from '@/features/modules'
import { dayKey, type DayStats } from '@/store/progress'

/** Learned, still being learned, and total; `learning + learned <= total`. */
export interface Bar {
  learned: number
  learning: number
  total: number
}

export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)

/**
 * A word counts as learned once either of its word cards (recognition, recall) has
 * graduated from the short-term learning steps (`isLearned`), and as being learned
 * once either was practised at all.
 */
export function wordState(cards: Cards, lang: TargetLang, id: string): 'new' | 'learning' | 'learned' {
  const rec = cards[cardKey(lang, 'recognition', id)]
  const recall = cards[cardKey(lang, 'recall', id)]
  if (isLearned(rec) || isLearned(recall)) return 'learned'
  if (rec || recall) return 'learning'
  return 'new'
}

function wordBar(cards: Cards, lang: TargetLang, words: Concept[]): Bar {
  const bar: Bar = { learned: 0, learning: 0, total: words.length }
  for (const w of words) {
    const st = wordState(cards, lang, w.id)
    if (st === 'learned') bar.learned++
    else if (st === 'learning') bar.learning++
  }
  return bar
}

/** The headline number: words of the course known in this language. */
export function courseProgress(lang: TargetLang, cards: Cards): Bar {
  return wordBar(cards, lang, conceptsFor(lang))
}

export interface ModuleProgress {
  skill: Skill
  status: ModuleStatus
}

export function moduleProgress(lang: TargetLang, cards: Cards, now = new Date()): ModuleProgress[] {
  return MODULES.map((m) => ({ skill: m.skill, status: moduleStatus(m.skill, lang, cards, now) }))
}

export interface UnitProgress {
  unit: Unit
  words: Bar
  sentences: { unlocked: number; total: number }
  questions: { unlocked: number; total: number }
  state: 'upcoming' | 'active' | 'done'
}

export function unitProgress(lang: TargetLang, cards: Cards): UnitProgress[] {
  const words = conceptsFor(lang)
  const unlockedIn = (skill: Skill) => {
    const items = moduleItems(skill, lang, cards)
    return (unit: string) => {
      const inUnit = items.filter((it) => it.unit === unit)
      return {
        unlocked: inUnit.filter((it) => it.unlock.unlocked || cards[cardKey(lang, skill, it.id)]).length,
        total: inUnit.length,
      }
    }
  }
  const sentences = unlockedIn('construction')
  const questions = unlockedIn('response')
  return [...units]
    .sort((a, b) => a.order - b.order)
    .map((unit) => {
      const bar = wordBar(cards, lang, words.filter((w) => w.unit === unit.id))
      const state = bar.total > 0 && bar.learned === bar.total ? 'done' : bar.learned + bar.learning > 0 ? 'active' : 'upcoming'
      return { unit, words: bar, sentences: sentences(unit.id), questions: questions(unit.id), state }
    })
}

/** Languages with at least one practised card. */
export function startedLanguages(cards: Cards): TargetLang[] {
  const langs = new Set<TargetLang>()
  for (const k of Object.keys(cards)) langs.add(parseCardKey(k as CardKey).lang)
  return (['ckb', 'fa'] as TargetLang[]).filter((l) => langs.has(l))
}

export interface DayActivity {
  day: string
  date: Date
  reviews: number
  correct: number
}

/** The last `n` local days, oldest first, ending today. */
export function activity(days: Record<string, DayStats>, now = new Date(), n = 14): DayActivity[] {
  const out: DayActivity[] = []
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = dayKey(date)
    out.push({ day: key, date, reviews: days[key]?.reviews ?? 0, correct: days[key]?.correct ?? 0 })
  }
  return out
}

/** Share of reviews answered correctly over the last `n` days; `pct` is null without reviews. */
export function accuracy(days: Record<string, DayStats>, now = new Date(), n = 7) {
  let reviews = 0
  let correct = 0
  for (const d of activity(days, now, n)) {
    reviews += d.reviews
    correct += d.correct
  }
  return { reviews, correct, pct: reviews ? Math.round((correct / reviews) * 100) : null }
}

/**
 * Reviews falling due on each of the next `n` local days, starting today.
 * Today includes everything already overdue.
 */
export function forecast(cards: Cards, lang: TargetLang, now = new Date(), n = 7): Array<{ day: string; date: Date; count: number }> {
  const out = Array.from({ length: n }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    return { day: dayKey(date), date, count: 0 }
  })
  const ends = out.map((d) => new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate() + 1).getTime())
  for (const [k, card] of Object.entries(cards)) {
    if (!card || parseCardKey(k as CardKey).lang !== lang) continue
    const due = new Date(card.due).getTime()
    const i = ends.findIndex((end) => due < end)
    if (i >= 0) out[i].count++
  }
  return out
}

export interface HardWord {
  concept: Concept
  lapses: number
  reps: number
}

/** Words forgotten most often (lapses over recognition and recall), most lapses first. */
export function hardestWords(cards: Cards, lang: TargetLang, limit = 8): HardWord[] {
  const byWord = new Map<string, { lapses: number; reps: number; difficulty: number }>()
  for (const [k, card] of Object.entries(cards)) {
    if (!card) continue
    const { lang: l, skill, itemId } = parseCardKey(k as CardKey)
    if (l !== lang || (skill !== 'recognition' && skill !== 'recall')) continue
    const w = byWord.get(itemId) ?? { lapses: 0, reps: 0, difficulty: 0 }
    w.lapses += card.lapses
    w.reps += card.reps
    w.difficulty = Math.max(w.difficulty, card.difficulty)
    byWord.set(itemId, w)
  }
  return [...byWord.entries()]
    .filter(([id, w]) => w.lapses > 0 && conceptById.has(id))
    .sort(([, a], [, b]) => b.lapses - a.lapses || b.difficulty - a.difficulty)
    .slice(0, limit)
    .map(([id, w]) => ({ concept: conceptById.get(id)!, lapses: w.lapses, reps: w.reps }))
}

/** Cards of a language due now, across all modules. */
export function dueNow(lang: TargetLang, cards: Cards, now = new Date()): number {
  return moduleProgress(lang, cards, now).reduce((n, m) => n + m.status.due, 0)
}

export interface SessionGain {
  course: { before: Bar; after: Bar }
  module: { before: ModuleStatus; after: ModuleStatus }
  /** Words that crossed into "learned" during the session. */
  newlyLearned: Concept[]
}

export function sessionGain(skill: Skill, lang: TargetLang, before: Cards, after: Cards, now = new Date()): SessionGain {
  const newlyLearned = conceptsFor(lang).filter(
    (c) => wordState(after, lang, c.id) === 'learned' && wordState(before, lang, c.id) !== 'learned',
  )
  return {
    course: { before: courseProgress(lang, before), after: courseProgress(lang, after) },
    module: { before: moduleStatus(skill, lang, before, now), after: moduleStatus(skill, lang, after, now) },
    newlyLearned,
  }
}
