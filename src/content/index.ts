import { z } from 'zod'
import evidenceJson from './generated/evidence.json'
import {
  grammarFileSchema,
  lexiconFileSchema,
  qaFileSchema,
  sentenceFileSchema,
  unitSchema,
} from './schema'
import unitsJson from './data/units.json'
import type {
  Concept,
  Form,
  GrammarPoint,
  LanguageEntry,
  QAItem,
  Sentence,
  TargetLang,
  Unit,
} from './types'

/*
 * All learning content lives as JSON under ./data, one file per unit and kind.
 * New files are picked up automatically. `npm run content:check` validates them
 * against the schema, orthography rules and the reference data.
 */

const lexiconFiles = import.meta.glob('./data/lexicon/*.json', { eager: true, import: 'default' })
const sentenceFiles = import.meta.glob('./data/sentences/*.json', { eager: true, import: 'default' })
const qaFiles = import.meta.glob('./data/qa/*.json', { eager: true, import: 'default' })
const grammarFiles = import.meta.glob('./data/grammar/*.json', { eager: true, import: 'default' })

function parseAll<S extends z.ZodType, K extends keyof z.infer<S>>(
  files: Record<string, unknown>,
  schema: S,
  key: K,
): Array<z.infer<S>[K] extends Array<infer T> ? T : never> {
  return Object.keys(files)
    .sort()
    .flatMap((path) => {
      const result = schema.safeParse(files[path])
      if (!result.success) {
        // Content is validated in CI; at runtime a broken file is skipped rather than crashing the app.
        console.error(`Invalid content file ${path}`, z.prettifyError(result.error))
        return []
      }
      return (result.data as Record<K, never[]>)[key]
    })
}

export const units: Unit[] = z
  .array(unitSchema)
  .parse(unitsJson.units)
  .sort((a, b) => a.order - b.order)

export const concepts: Concept[] = parseAll(lexiconFiles, lexiconFileSchema, 'concepts') as Concept[]
export const sentences: Sentence[] = parseAll(sentenceFiles, sentenceFileSchema, 'sentences') as Sentence[]
export const qaItems: QAItem[] = parseAll(qaFiles, qaFileSchema, 'items') as QAItem[]
export const grammarPoints: GrammarPoint[] = parseAll(grammarFiles, grammarFileSchema, 'points') as GrammarPoint[]

const unitOrder = new Map(units.map((u) => [u.id, u.order]))
const byUnit = <T extends { unit: string }>(a: T, b: T) =>
  (unitOrder.get(a.unit) ?? 999) - (unitOrder.get(b.unit) ?? 999)
concepts.sort(byUnit)
sentences.sort(byUnit)
qaItems.sort(byUnit)

export const conceptById = new Map(concepts.map((c) => [c.id, c]))
export const sentenceById = new Map(sentences.map((s) => [s.id, s]))
export const qaById = new Map(qaItems.map((q) => [q.id, q]))
export const grammarById = new Map(grammarPoints.map((g) => [g.id, g]))
export const unitById = new Map(units.map((u) => [u.id, u]))

export function conceptsFor(lang: TargetLang): Concept[] {
  return concepts.filter((c) => c[lang])
}
export function sentencesFor(lang: TargetLang): Sentence[] {
  return sentences.filter((s) => s[lang])
}
export function qaFor(lang: TargetLang): QAItem[] {
  return qaItems.filter((q) => q[lang])
}
export function grammarFor(lang: TargetLang): GrammarPoint[] {
  return grammarPoints.filter((g) => g.lang === lang)
}

/** Every form accepted as a correct answer for this concept, primary first. */
export function acceptedForms(entry: LanguageEntry): Form[] {
  return [entry.primary, ...(entry.variants ?? [])]
}

export type EvidenceLevel = 'native-reviewed' | 'strong' | 'good' | 'attested' | 'none'

export interface Evidence {
  level: EvidenceLevel
  /** Human-readable list of what confirmed this item, e.g. "Wiktionary translation table". */
  checks: string[]
  audio?: string
  ipa?: string
}

const evidence = evidenceJson as unknown as Record<string, Evidence>

/** Verification evidence computed by `npm run content:check`. Keys: `concept:ckb:water`, `sentence:fa:id`, ... */
export function evidenceFor(kind: 'concept' | 'sentence' | 'qa', lang: TargetLang, id: string): Evidence {
  return evidence[`${kind}:${lang}:${id}`] ?? { level: 'none', checks: [] }
}
