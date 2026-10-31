import type { GrammarPoint, Sentence, SourceClaim, TargetLang, Unit } from '@/content/types'

export interface GrammarGroup {
  unit: Unit | undefined
  unitId: string
  points: GrammarPoint[]
}

/** Points of one language grouped by unit, in curriculum order. Within a unit, content order is kept. */
export function groupByUnit(points: GrammarPoint[], lang: TargetLang, units: Unit[]): GrammarGroup[] {
  const order = new Map(units.map((u) => [u.id, u.order]))
  const byId = new Map(units.map((u) => [u.id, u]))
  const groups = new Map<string, GrammarPoint[]>()
  for (const p of points) {
    if (p.lang !== lang) continue
    groups.set(p.unit, [...(groups.get(p.unit) ?? []), p])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
    .map(([unitId, pts]) => ({ unitId, unit: byId.get(unitId), points: pts }))
}

/** Flat reading order, used for previous/next navigation. */
export function readingOrder(points: GrammarPoint[], lang: TargetLang, units: Unit[]): GrammarPoint[] {
  return groupByUnit(points, lang, units).flatMap((g) => g.points)
}

const suffix = (id: string) => id.replace(/^(ckb|fa)-/, '')

/*
 * The same topic in the other language. Ids are meant to differ only by prefix
 * (`ckb-ezafe` / `fa-ezafe`), but some topics are named after how each
 * language does it (`ckb-possessive-clitics` / `fa-possessive-suffixes`), so
 * a shared first word is the fallback, preferring the same unit.
 */
const ALIASES: Record<string, string> = {
  politeness: 'formal-colloquial',
  'formal-colloquial': 'politeness',
}

export function counterpartOf(point: GrammarPoint, points: GrammarPoint[]): GrammarPoint | undefined {
  const otherLang: TargetLang = point.lang === 'ckb' ? 'fa' : 'ckb'
  const candidates = points.filter((p) => p.lang === otherLang)
  const own = suffix(point.id)
  const exact = candidates.find((p) => suffix(p.id) === own || suffix(p.id) === ALIASES[own])
  if (exact) return exact
  const head = own.split('-')[0]
  const loose = candidates.filter((p) => suffix(p.id).split('-')[0] === head)
  return loose.find((p) => p.unit === point.unit) ?? loose[0]
}

export function sentencesWithGrammar(sentences: Sentence[], lang: TargetLang, id: string): Sentence[] {
  return sentences.filter((s) => s[lang]?.grammar?.includes(id))
}

interface CitationStrings {
  citation: Record<SourceClaim['source'], string>
  chapter: (name: string) => string
}

/** A human-readable reference, e.g. "W. M. Thackston, Sorani Kurdish: ..., §15". */
export function formatCitation(claim: SourceClaim, s: CitationStrings): string {
  const title = s.citation[claim.source] ?? claim.source
  const ref = claim.ref?.trim()
  if (!ref) return title
  if (claim.source === 'thackston-sorani-grammar' || claim.source === 'kim-kurdish-grammar') {
    return /^(§|p\.|pp\.|\d)/.test(ref) ? `${title}, ${ref}` : `${title}, ${s.chapter(ref)}`
  }
  return `${title}: ${ref}`
}
