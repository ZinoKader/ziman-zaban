import { acceptedForms, conceptsFor } from '@/content'
import type { BaseLang, Concept, TargetLang } from '@/content/types'
import { foldForMatch } from '@/lib/script/normalize'

/** Small seeded PRNG so a given exercise always shows the same options. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Picks wrong options that are plausible: same part of speech and unit first,
 * then same part of speech, then anything. Options with the same meaning text
 * or the same written word as the answer (or each other) are excluded so that
 * there is exactly one right answer (ژن is both "woman" and "wife").
 */
export function pickConceptDistractors(
  target: Concept,
  lang: TargetLang,
  baseLang: BaseLang,
  count: number,
  random: () => number,
  /** Prefer words the learner has already met, so options aren't random unknowns. */
  known?: Set<string>,
): Concept[] {
  const pool = conceptsFor(lang).filter((c) => c.id !== target.id)
  const glosses = (c: Concept) =>
    [c.gloss[baseLang], ...((baseLang === 'en' ? c.gloss.enAlt : c.gloss.svAlt) ?? [])].map((g) => g.toLowerCase())
  const seen = new Set(glosses(target))
  const words = (c: Concept) => {
    const entry = c[lang]
    return entry ? acceptedForms(entry).map((f) => foldForMatch(f.script, lang)) : []
  }
  const seenWords = new Set(words(target))
  const tiers = [
    (c: Concept) => c.pos === target.pos && c.unit === target.unit,
    (c: Concept) => c.pos === target.pos && (!known || known.has(c.id)),
    (c: Concept) => c.unit === target.unit,
    (c: Concept) => !known || known.has(c.id),
    () => true,
  ]
  const out: Concept[] = []
  for (const tier of tiers) {
    for (const c of shuffle(pool.filter(tier), random)) {
      if (out.length >= count) return out
      const g = glosses(c)
      const w = words(c)
      if (g.some((x) => seen.has(x)) || out.includes(c) || w.some((x) => seenWords.has(x))) continue
      seen.add(g[0])
      for (const x of w) seenWords.add(x)
      out.push(c)
    }
  }
  return out
}
