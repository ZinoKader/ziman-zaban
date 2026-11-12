import { TARGET_LANGS, type TargetLang } from '@/content/types'
import {
  addDays,
  dayKey,
  totalDays,
  type ContentReport,
  type DayStats,
  type DaysByLang,
  type MedalsByLang,
  type Progress,
  type ReviewEntry,
} from '@/lib/progress'
import { cardKey, parseCardKey, type CardKey, type Grade, type StoredCard } from '@/lib/srs'
import type { Tables, TablesInsert } from './database.types'

export type CardRow = Tables<'cards'>
export type ReviewRow = Tables<'reviews'>
export type DayRow = Tables<'daily_totals'>
export type MedalRow = Tables<'medals'>
export type ReportRow = Tables<'content_reports'>

export type ProgressRows = {
  reviews?: TablesInsert<'reviews'>[]
  cards?: TablesInsert<'cards'>[]
  days?: TablesInsert<'daily_totals'>[]
  medals?: TablesInsert<'medals'>[]
  reports?: TablesInsert<'content_reports'>[]
}

const iso = (t: string) => new Date(t).toISOString()
const byTime = <T extends { at: string }>(a: T, b: T) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)

export function cardInsert(key: CardKey, c: StoredCard): TablesInsert<'cards'> {
  const { lang, skill, itemId } = parseCardKey(key)
  return {
    lang,
    skill,
    item_id: itemId,
    state: c.state,
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    last_review: c.last_review ?? null,
    created_at: c.createdAt,
  }
}

export function cardFromRow(r: CardRow): [CardKey, StoredCard] {
  const card: StoredCard = {
    due: iso(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    ...(r.last_review ? { last_review: iso(r.last_review) } : {}),
    createdAt: iso(r.created_at),
  }
  return [cardKey(r.lang, r.skill, r.item_id), card]
}

export function reviewInsert(e: ReviewEntry, card: StoredCard | undefined): TablesInsert<'reviews'> {
  const { lang, skill, itemId } = parseCardKey(e.key)
  return {
    lang,
    skill,
    item_id: itemId,
    grade: e.grade,
    kind: e.kind,
    ms: Math.max(0, Math.round(e.ms)),
    reviewed_at: e.at,
    day: dayKey(new Date(e.at)),
    is_new: card?.createdAt === e.at,
  }
}

export function reviewFromRow(r: ReviewRow): ReviewEntry {
  return { key: cardKey(r.lang, r.skill, r.item_id), grade: r.grade as Grade, at: iso(r.reviewed_at), ms: r.ms, kind: r.kind }
}

export function medalInserts(lang: TargetLang, medals: MedalsByLang[TargetLang] = []): TablesInsert<'medals'>[] {
  return medals.map((m) => ({ lang, words: m.words, earned_at: m.at }))
}

export function reportInsert(r: ContentReport): TablesInsert<'content_reports'> {
  return { item_key: r.key, message: r.message, created_at: r.at }
}

function dayInsert(lang: TargetLang, day: string, d: DayStats): TablesInsert<'daily_totals'> {
  return { lang, day, reviews: d.reviews, correct: d.correct, new_items: d.newItems, ms: Math.round(d.ms) }
}

function remainder(total: DayStats, parts: DayStats[]): DayStats {
  const sum = parts.reduce<DayStats>((a, p) => addDays(a, p), { reviews: 0, correct: 0, newItems: 0, ms: 0 })
  return {
    reviews: Math.max(0, total.reviews - sum.reviews),
    correct: Math.max(0, total.correct - sum.correct),
    newItems: Math.max(0, total.newItems - sum.newItems),
    ms: Math.max(0, total.ms - sum.ms),
  }
}

export function dayInserts(days: Record<string, DayStats>, daysByLang: DaysByLang, fallback: TargetLang): TablesInsert<'daily_totals'>[] {
  const merged: DaysByLang = Object.fromEntries(TARGET_LANGS.map((l) => [l, { ...(daysByLang[l] ?? {}) }]))
  for (const [day, total] of Object.entries(days)) {
    const rest = remainder(total, TARGET_LANGS.map((l) => daysByLang[l]?.[day] ?? { reviews: 0, correct: 0, newItems: 0, ms: 0 }))
    if (rest.reviews) merged[fallback]![day] = addDays(merged[fallback]![day], rest)
  }
  return TARGET_LANGS.flatMap((lang) => Object.entries(merged[lang] ?? {}).map(([day, d]) => dayInsert(lang, day, d)))
}

export interface FullProgress extends Progress {
  log: ReviewEntry[]
}

export function progressRows(p: FullProgress, fallback: TargetLang): ProgressRows {
  return {
    reviews: p.log.map((e) => reviewInsert(e, p.cards[e.key])),
    cards: (Object.entries(p.cards) as [CardKey, StoredCard][]).map(([k, c]) => cardInsert(k, c)),
    days: dayInserts(p.days, p.daysByLang, fallback),
    medals: TARGET_LANGS.flatMap((lang) => medalInserts(lang, p.medals[lang])),
    reports: p.reports.map(reportInsert),
  }
}

export function progressFromRows(rows: { cards: CardRow[]; days: DayRow[]; medals: MedalRow[]; reports: ReportRow[] }): Progress {
  const daysByLang: DaysByLang = {}
  for (const r of rows.days) {
    ;(daysByLang[r.lang] ??= {})[r.day] = { reviews: r.reviews, correct: r.correct, newItems: r.new_items, ms: Number(r.ms) }
  }
  const medals: MedalsByLang = {}
  for (const m of [...rows.medals].sort((a, b) => a.words - b.words)) {
    ;(medals[m.lang] ??= []).push({ words: m.words, at: iso(m.earned_at) })
  }
  return {
    cards: Object.fromEntries(rows.cards.map(cardFromRow)),
    days: totalDays(daysByLang),
    daysByLang,
    reports: rows.reports.map((r) => ({ key: r.item_key, message: r.message, at: iso(r.created_at) })).sort(byTime),
    medals,
  }
}
