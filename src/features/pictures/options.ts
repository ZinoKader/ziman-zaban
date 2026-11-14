import { pictureWord, picturesFor } from '@/content/pictures'
import type { Picture, TargetLang } from '@/content/types'
import { shuffle } from '@/lib/distractors'
import { foldForMatch } from '@/lib/script/normalize'

function forms(p: Picture, lang: TargetLang): string[] {
  const entry = pictureWord(p, lang)?.entry
  if (!entry) return []
  return [entry.primary, ...(entry.variants ?? [])].map((f) => foldForMatch(f.script, lang))
}

/**
 * The answer and `count` wrong pictures, shuffled. Wrong options come from the same area first, so a
 * dish is told apart from other dishes. No two options share a written form, so exactly one is right.
 */
export function pictureOptions(target: Picture, lang: TargetLang, count: number, random: () => number): Picture[] {
  const pool = picturesFor(lang).filter((p) => p.id !== target.id)
  const sameArea = shuffle(
    pool.filter((p) => p.area === target.area),
    random,
  )
  const elsewhere = shuffle(
    pool.filter((p) => p.area !== target.area),
    random,
  )
  const taken = new Set(forms(target, lang))
  const wrong: Picture[] = []
  for (const p of [...sameArea, ...elsewhere]) {
    if (wrong.length === count) break
    const f = forms(p, lang)
    if (f.some((x) => taken.has(x))) continue
    f.forEach((x) => taken.add(x))
    wrong.push(p)
  }
  return shuffle([target, ...wrong], random)
}
