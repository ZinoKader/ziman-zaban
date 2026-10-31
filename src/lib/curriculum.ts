import {
  conceptsFor,
  qaFor,
  sentencesFor,
  unitById,
} from '@/content'
import type { Concept, QAItem, Sentence, Skill, TargetLang, Token } from '@/content/types'
import { cardKey, inLearningSteps, isDue, isLearned, retrievability, type CardKey, type StoredCard } from '@/lib/srs'

/*
 * The four modules form a path from understanding to speaking:
 *
 *   recognition  target word -> meaning        a word enters here when first introduced
 *   recall       meaning -> target word        unlocked once a word is recognised reliably
 *   construction build whole sentences         unlocked once all its words have been introduced
 *   response     answer questions in-language  unlocked once its words can be recalled
 *
 * Testing in the direction you want to master matters: receptive practice builds
 * receptive knowledge, productive practice builds productive knowledge.
 */

export type Cards = Partial<Record<CardKey, StoredCard>>

export interface Candidate {
  key: CardKey
  itemId: string
  isNew: boolean
  /** Lower comes first among new items (curriculum order). */
  order: number
  card?: StoredCard
}

function unitOrder(unit: string): number {
  return unitById.get(unit)?.order ?? 999
}

const tokenConcepts = (tokens: Token[] | undefined) =>
  [...new Set((tokens ?? []).map((t) => t.concept).filter((c): c is string => !!c))]

export function sentenceConcepts(s: Sentence, lang: TargetLang): string[] {
  return tokenConcepts(s[lang]?.tokens)
}

export function qaConcepts(q: QAItem, lang: TargetLang): string[] {
  const f = q[lang]
  if (!f) return []
  return tokenConcepts([...(f.question.tokens ?? []), ...(f.answers[0]?.tokens ?? [])])
}

const introduced = (cards: Cards, lang: TargetLang, conceptId: string) =>
  !!cards[cardKey(lang, 'recognition', conceptId)]

const recallable = (cards: Cards, lang: TargetLang, conceptId: string) =>
  !!cards[cardKey(lang, 'recall', conceptId)]

export interface UnlockState {
  unlocked: boolean
  /** Concepts still missing before this item unlocks. */
  missing: string[]
}

export function conceptUnlock(c: Concept, skill: 'recognition' | 'recall', lang: TargetLang, cards: Cards): UnlockState {
  if (skill === 'recognition') return { unlocked: true, missing: [] }
  const rec = cards[cardKey(lang, 'recognition', c.id)]
  const ok = isLearned(rec) || (rec?.reps ?? 0) >= 3
  return { unlocked: ok, missing: ok ? [] : [c.id] }
}

export function sentenceUnlock(s: Sentence, lang: TargetLang, cards: Cards): UnlockState {
  const missing = sentenceConcepts(s, lang).filter((c) => !introduced(cards, lang, c))
  return { unlocked: missing.length === 0, missing }
}

export function qaUnlock(q: QAItem, lang: TargetLang, cards: Cards): UnlockState {
  const missing = qaConcepts(q, lang).filter((c) => !recallable(cards, lang, c) && !introduced(cards, lang, c))
  const notRecallable = qaConcepts(q, lang).filter((c) => !recallable(cards, lang, c))
  // Allow at most a third of the words to be known only receptively; the question gives context.
  const ok = missing.length === 0 && notRecallable.length <= Math.floor(qaConcepts(q, lang).length / 3)
  return { unlocked: ok, missing: ok ? [] : notRecallable }
}

/** Items of a module for one language, with their card (if any) and unlock state. */
export function moduleItems(skill: Skill, lang: TargetLang, cards: Cards) {
  switch (skill) {
    case 'recognition':
    case 'recall':
      return conceptsFor(lang).map((c, i) => ({
        id: c.id,
        order: unitOrder(c.unit) * 10_000 + i,
        unit: c.unit,
        unlock: conceptUnlock(c, skill, lang, cards),
      }))
    case 'construction':
      return sentencesFor(lang).map((s, i) => ({
        id: s.id,
        order: unitOrder(s.unit) * 10_000 + i,
        unit: s.unit,
        unlock: sentenceUnlock(s, lang, cards),
      }))
    case 'response':
      return qaFor(lang).map((q, i) => ({
        id: q.id,
        order: unitOrder(q.unit) * 10_000 + i,
        unit: q.unit,
        unlock: qaUnlock(q, lang, cards),
      }))
  }
}

export interface ModuleStatus {
  total: number
  unlocked: number
  started: number
  learned: number
  due: number
  /** Unlocked but never practised. */
  available: number
}

export function moduleStatus(skill: Skill, lang: TargetLang, cards: Cards, now = new Date()): ModuleStatus {
  const items = moduleItems(skill, lang, cards)
  let unlocked = 0
  let started = 0
  let learned = 0
  let due = 0
  for (const it of items) {
    const card = cards[cardKey(lang, skill, it.id)]
    if (card) {
      started++
      if (isLearned(card)) learned++
      if (isDue(card, now)) due++
    }
    if (it.unlock.unlocked || card) unlocked++
  }
  return { total: items.length, unlocked, started, learned, due, available: unlocked - started }
}

/**
 * Cards in their short learning steps (due again in minutes) are taken this far ahead
 * of time, as Anki's default "learn ahead limit" does. Otherwise a word answered once
 * is skipped by every session started before its step is up, and new words pile up unreviewed.
 */
export const LEARN_AHEAD_MS = 20 * 60_000

function dueForSession(card: StoredCard, now: Date): boolean {
  if (isDue(card, now)) return true
  return inLearningSteps(card) && new Date(card.due).getTime() - now.getTime() <= LEARN_AHEAD_MS
}

export interface QueueOptions {
  size: number
  maxNew: number
  now?: Date
  /** Only items from these units (for unit practice). */
  units?: string[]
  /** Deterministic shuffling in tests. */
  random?: () => number
}

/**
 * Builds a practice session: due reviews first (weakest first), with new items
 * spread between them so that each session mixes consolidation and new material.
 */
export function buildQueue(skill: Skill, lang: TargetLang, cards: Cards, opts: QueueOptions): Candidate[] {
  const now = opts.now ?? new Date()
  const random = opts.random ?? Math.random
  const items = moduleItems(skill, lang, cards).filter((it) => !opts.units || opts.units.includes(it.unit))

  const due: Candidate[] = []
  const fresh: Candidate[] = []
  for (const it of items) {
    const key = cardKey(lang, skill, it.id)
    const card = cards[key]
    if (card) {
      if (dueForSession(card, now)) due.push({ key, itemId: it.id, isNew: false, order: it.order, card })
    } else if (it.unlock.unlocked) {
      fresh.push({ key, itemId: it.id, isNew: true, order: it.order })
    }
  }

  due.sort((a, b) => retrievability(a.card!, now) - retrievability(b.card!, now) || random() - 0.5)
  fresh.sort((a, b) => a.order - b.order)

  const reviews = due.slice(0, opts.size)
  const newOnes = fresh.slice(0, Math.max(0, Math.min(opts.maxNew, opts.size - reviews.length)))

  // Interleave: after every couple of reviews, slot in a new item.
  const out: Candidate[] = []
  const gap = newOnes.length ? Math.max(1, Math.floor(reviews.length / newOnes.length)) : Infinity
  let r = 0
  let n = 0
  while (r < reviews.length || n < newOnes.length) {
    for (let i = 0; i < gap && r < reviews.length; i++) out.push(reviews[r++])
    if (n < newOnes.length) out.push(newOnes[n++])
  }
  return out
}
