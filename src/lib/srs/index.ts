import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs'
import type { Skill, TargetLang } from '@/content/types'
import type { MatchGrade } from '@/lib/script/match'

export { Rating, State }
export type { Grade }

/** One card per (language, skill, item): `ckb:recognition:water`, `fa:response:qa-name`. */
export type CardKey = `${TargetLang}:${Skill}:${string}`

export function cardKey(lang: TargetLang, skill: Skill, itemId: string): CardKey {
  return `${lang}:${skill}:${itemId}`
}

export function parseCardKey(key: CardKey): { lang: TargetLang; skill: Skill; itemId: string } {
  const [lang, skill, ...rest] = key.split(':')
  return { lang: lang as TargetLang, skill: skill as Skill, itemId: rest.join(':') }
}

/** JSON-safe FSRS card as kept in localStorage. */
export interface StoredCard {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: State
  last_review?: string
  createdAt: string
}

/*
 * FSRS (Free Spaced Repetition Scheduler) schedules each review for when the
 * predicted probability of recall drops to `request_retention`. 0.9 is the
 * recommended default: reviews are spaced as far apart as possible while 9 of
 * 10 reviews still succeed, which keeps retrieval effortful but successful.
 */
export const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
})

function toCard(c: StoredCard): Card {
  return {
    ...c,
    due: new Date(c.due),
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  }
}

function fromCard(c: Card, createdAt: string): StoredCard {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review?.toISOString(),
    createdAt,
  }
}

export function newCard(now: Date): StoredCard {
  return fromCard(createEmptyCard(now), now.toISOString())
}

export function reviewCard(card: StoredCard | undefined, grade: Grade, now: Date): StoredCard {
  const current = card ?? newCard(now)
  const { card: next } = scheduler.next(toCard(current), now, grade)
  return fromCard(next, current.createdAt)
}

export function isDue(card: StoredCard, now: Date): boolean {
  return new Date(card.due).getTime() <= now.getTime()
}

/** Predicted probability (0–1) of recalling the card right now. */
export function retrievability(card: StoredCard, now: Date): number {
  if (card.state === State.New) return 0
  return scheduler.get_retrievability(toCard(card), now, false)
}

/** A card has "graduated" once it left the short-term learning steps at least once. */
export function isLearned(card: StoredCard | undefined): boolean {
  return !!card && (card.state === State.Review || (card.state === State.Relearning && card.lapses > 0))
}

/** How well a card is known, for progress displays. */
export type Strength = 'new' | 'learning' | 'young' | 'mature'

export function strength(card: StoredCard | undefined): Strength {
  if (!card || card.state === State.New) return 'new'
  if (card.state === State.Learning || card.state === State.Relearning) return 'learning'
  return card.stability >= 21 ? 'mature' : 'young'
}

export interface Outcome {
  /** null for self-graded exercises, where `selfGrade` is used. */
  match: MatchGrade | null
  selfGrade?: Grade
  hintsUsed: number
  /** Wrong before getting it right within the same exercise. */
  attempts: number
  responseMs: number
  /** Milliseconds under which a perfect answer counts as effortless. */
  fastMs: number
}

/**
 * Turns what happened in an exercise into an FSRS grade.
 * Failing (or needing to be shown the answer) is Again; a slip or a hint is Hard;
 * a clean answer is Good, or Easy when it was also fast.
 */
export function gradeOutcome(o: Outcome): Grade {
  if (o.selfGrade) return o.hintsUsed > 0 && o.selfGrade > Rating.Hard ? Rating.Hard : o.selfGrade
  if (o.match === 'wrong' || o.match === null) return Rating.Again
  if (o.attempts > 1) return Rating.Again
  if (o.match === 'typo' || o.hintsUsed > 0) return Rating.Hard
  return o.responseMs < o.fastMs ? Rating.Easy : Rating.Good
}
