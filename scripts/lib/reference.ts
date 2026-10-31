import fs from 'node:fs'
import path from 'node:path'
import type { Concept, Form, TargetLang } from '../../src/content/types'
import { foldForMatch } from '../../src/lib/script/normalize'
import { checkRomanization, persianLatinSkeleton } from '../../src/lib/script/skeleton'

const REF = path.resolve(import.meta.dirname, '../../reference')

export interface EnSense {
  pos: string
  sense: string
  fa?: Array<[string, string]>
  ckb?: Array<[string, string]>
  sv?: string[]
}
export interface WiktEntry {
  w: string
  pos: string
  r: string[]
  g: string[]
  ipa?: string
  audio?: string
}
export interface TatoebaIndex {
  sentenceCount: number
  pairs: Array<[number, string, string]>
  tokens: Record<string, number>
}

function load<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(REF, name), 'utf8')) as T
}

let cache: {
  en: Record<string, EnSense[]>
  wikt: Record<TargetLang, Record<string, WiktEntry[]>>
  tatoeba: Record<TargetLang, TatoebaIndex>
} | null = null

export function reference() {
  cache ??= {
    en: load('en-translations.json'),
    wikt: { fa: load('fa-wiktionary.json'), ckb: load('ckb-wiktionary.json') },
    tatoeba: { fa: load('tatoeba-fa.json'), ckb: load('tatoeba-ckb.json') },
  }
  return cache
}

/** English headwords to try for a gloss like "to eat (a meal)" -> ["eat", "to eat", ...]. */
export function englishHeadwords(glosses: string[]): string[] {
  const out = new Set<string>()
  for (const g of glosses) {
    for (const part of g.split(/\s*[/;,]\s*/)) {
      const base = part.replace(/\(.*?\)/g, '').replace(/[!?.]/g, '').trim()
      if (!base) continue
      out.add(base)
      out.add(base.toLowerCase())
      out.add(base.replace(/^(to|a|an|the)\s+/i, ''))
    }
  }
  return [...out].filter(Boolean)
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ')
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'one', 'someone', 'something'].includes(w)),
  )

export interface FormEvidence {
  /** English Wiktionary lists this spelling as a translation of the English gloss. */
  translationTable: boolean
  /** A Wiktionary entry for this spelling exists. */
  entryExists: boolean
  /** ...and one of its glosses shares a content word with ours. */
  entryGlossMatch: boolean
  /** Number of Tatoeba sentences containing every word of this form. */
  tatoebaHits: number
  /** Romanization skeleton matches script. */
  romanizationConsistent: boolean
  /** Persian only: our romanization agrees with Wiktionary's (consonant skeleton). */
  romanizationMatchesWiktionary?: boolean
  wiktionaryAudio?: string
  wiktionaryIpa?: string
}

export type EvidenceLevel = 'strong' | 'good' | 'attested' | 'none'

export function formEvidence(form: Form, lang: TargetLang, glossesEn: string[]): FormEvidence {
  const ref = reference()
  const key = foldForMatch(form.script, lang)
  const heads = englishHeadwords(glossesEn)

  const translationTable = heads.some((h) =>
    (ref.en[h] ?? []).some((s) => (s[lang] ?? []).some(([w]) => foldForMatch(w, lang) === key)),
  )
  const entries = ref.wikt[lang][key] ?? []
  const ours = new Set(glossesEn.flatMap((g) => [...words(g)]))
  const entryGlossMatch = entries.some((e) => e.g.some((g) => [...words(g)].some((w) => ours.has(w))))

  const parts = form.script.split(/[\s\u200C]+/).map((p) => foldForMatch(p, lang)).filter(Boolean)
  const tokens = ref.tatoeba[lang].tokens
  const tatoebaHits = parts.length ? Math.min(...parts.map((p) => tokens[p] ?? 0)) : 0

  const ev: FormEvidence = {
    translationTable,
    entryExists: entries.length > 0,
    entryGlossMatch,
    tatoebaHits,
    romanizationConsistent: checkRomanization(form.script, form.latin, lang).ok,
  }
  if (lang === 'fa' && entries.length) {
    const ours = persianLatinSkeleton(form.latin)
    ev.romanizationMatchesWiktionary = entries.some((e) => e.r.some((r) => persianLatinSkeleton(r) === ours))
  }
  const withAudio = entries.find((e) => e.audio)
  if (withAudio?.audio) ev.wiktionaryAudio = withAudio.audio
  const withIpa = entries.find((e) => e.ipa)
  if (withIpa?.ipa) ev.wiktionaryIpa = withIpa.ipa
  return ev
}

export function evidenceLevel(ev: FormEvidence): EvidenceLevel {
  const corpus = ev.tatoebaHits > 0
  if (ev.translationTable && (ev.entryGlossMatch || corpus)) return 'strong'
  if (ev.translationTable || ev.entryGlossMatch) return 'good'
  if (ev.entryExists || corpus) return 'attested'
  return 'none'
}

export function conceptGlossesEn(c: Concept): string[] {
  return [c.gloss.en, ...(c.gloss.enAlt ?? [])]
}

/** Swedish check: does Wiktionary list our Swedish gloss as a translation of the English one? */
export function swedishMatches(c: Concept): boolean {
  const ref = reference()
  const sv = new Set([c.gloss.sv, ...(c.gloss.svAlt ?? [])].map((s) => s.toLowerCase().replace(/^att\s+/, '')))
  return englishHeadwords(conceptGlossesEn(c)).some((h) =>
    (ref.en[h] ?? []).some((s) => (s.sv ?? []).some((w) => sv.has(w.toLowerCase()))),
  )
}
