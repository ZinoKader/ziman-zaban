import type { Concept, Form, LanguageEntry, TargetLang } from '@/content/types'
import { foldForMatch, foldLatin, isArabicScript } from '@/lib/script/normalize'

export interface WordIndexEntry {
  concept: Concept
  /** Folded English and Swedish meanings, accepted alternatives and sense notes. */
  base: string[]
  /** Arabic-script forms folded per language. */
  script: Array<{ lang: TargetLang; key: string }>
  /** Romanizations folded with `foldLatin`. */
  latin: string[]
}

/** Lower score is a better match. */
export interface WordMatch {
  concept: Concept
  score: number
}

/** Case-, accent- and punctuation-insensitive form of English or Swedish text. */
export function foldBase(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function entryForms(entry: LanguageEntry): Form[] {
  return [entry.primary, ...(entry.variants ?? []), entry.plural, entry.presentStem, entry.pastStem].filter(
    (f): f is Form => !!f,
  )
}

/**
 * Builds a search index over the concepts of `lang`. With `compare`, the other
 * language's forms are searchable too, since they are shown in compare mode.
 */
export function buildWordIndex(concepts: Concept[], lang: TargetLang, compare = false): WordIndexEntry[] {
  const langs: TargetLang[] = compare ? [lang, lang === 'ckb' ? 'fa' : 'ckb'] : [lang]
  return concepts
    .filter((c) => c[lang])
    .map((concept) => {
      const { gloss, senseNote } = concept
      const base = [gloss.en, gloss.sv, ...(gloss.enAlt ?? []), ...(gloss.svAlt ?? [])]
      if (senseNote) base.push(senseNote.en, senseNote.sv)
      const script: WordIndexEntry['script'] = []
      const latin: string[] = []
      for (const l of langs) {
        const entry = concept[l]
        if (!entry) continue
        for (const form of entryForms(entry)) {
          script.push({ lang: l, key: foldForMatch(form.script, l) })
          latin.push(foldLatin(form.latin))
        }
      }
      return { concept, base: base.map(foldBase).filter(Boolean), script, latin: latin.filter(Boolean) }
    })
}

function scoreKey(key: string, query: string): number {
  if (key === query) return 0
  if (key.startsWith(query)) return 1
  if (key.includes(query)) return 3
  return Infinity
}

function scoreBase(text: string, query: string): number {
  const exact = scoreKey(text, query)
  if (exact < 3) return exact
  // A whole-word hit ("she" in "he she") is almost as good as a prefix.
  if (text.split(' ').some((w) => w.startsWith(query))) return 2
  return exact
}

/**
 * Matches a free-text query against meanings (English and Swedish), Arabic
 * script (Sorani or Persian, ignoring spelling variants that do not change the
 * word) and any common romanization. Results keep index order within equal scores.
 */
export function searchWords(index: WordIndexEntry[], rawQuery: string): WordMatch[] {
  const query = rawQuery.trim()
  if (!query) return index.map((e) => ({ concept: e.concept, score: 0 }))

  const matches: WordMatch[] = []
  if (isArabicScript(query)) {
    const folded = { ckb: foldForMatch(query, 'ckb'), fa: foldForMatch(query, 'fa') }
    for (const e of index) {
      let best = Infinity
      for (const s of e.script) if (folded[s.lang]) best = Math.min(best, scoreKey(s.key, folded[s.lang]))
      if (best < Infinity) matches.push({ concept: e.concept, score: best })
    }
  } else {
    const base = foldBase(query)
    const latin = foldLatin(query)
    for (const e of index) {
      let best = Infinity
      if (base) for (const b of e.base) best = Math.min(best, scoreBase(b, base))
      if (latin) for (const k of e.latin) best = Math.min(best, scoreKey(k, latin) + 0.5)
      if (best < Infinity) matches.push({ concept: e.concept, score: best })
    }
  }
  return matches.map((m, i) => ({ m, i })).sort((a, b) => a.m.score - b.m.score || a.i - b.i).map(({ m }) => m)
}
