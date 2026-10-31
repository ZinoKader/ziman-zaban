import type { EvidenceLevel } from '@/content'
import evidenceJson from '@/content/generated/evidence.json'
import type { TargetLang } from '@/content/types'

export const EVIDENCE_LEVELS: EvidenceLevel[] = ['native-reviewed', 'strong', 'good', 'attested', 'none']
export const EVIDENCE_KINDS = ['concept', 'sentence', 'qa'] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

export type LevelCounts = Record<EvidenceLevel, number> & { total: number }
export type EvidenceCounts = Record<EvidenceKind, Record<TargetLang, LevelCounts>>

const empty = (): LevelCounts => ({ 'native-reviewed': 0, strong: 0, good: 0, attested: 0, none: 0, total: 0 })

/** Items per evidence level, per kind and language, from the validator output (`npm run content:check`). */
export function countEvidence(data: Record<string, { level: string }> = evidenceJson): EvidenceCounts {
  const counts = Object.fromEntries(
    EVIDENCE_KINDS.map((k) => [k, { ckb: empty(), fa: empty() }]),
  ) as EvidenceCounts
  for (const [key, value] of Object.entries(data)) {
    const [kind, lang] = key.split(':')
    const bucket = counts[kind as EvidenceKind]?.[lang as TargetLang]
    if (!bucket || !EVIDENCE_LEVELS.includes(value.level as EvidenceLevel)) continue
    bucket[value.level as EvidenceLevel]++
    bucket.total++
  }
  return counts
}

/** First item id at a level, to show a live badge. */
export function exampleIdAt(level: EvidenceLevel, lang: TargetLang, data: Record<string, { level: string }> = evidenceJson) {
  const key = Object.keys(data).find((k) => k.startsWith(`concept:${lang}:`) && data[k].level === level)
  return key?.split(':')[2]
}
