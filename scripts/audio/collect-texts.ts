/**
 * Collects every target-language text the app can play, keyed by canonical text.
 *
 *   npm run audio:collect    writes scripts/audio/.texts.json (input for generate.py)
 *
 * Invalid content files are skipped with a warning (content:check reports them).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { z } from 'zod'
import { collectAudioTexts } from '../../src/content/audio-texts'
import { grammarFileSchema, lexiconFileSchema, qaFileSchema, sentenceFileSchema } from '../../src/content/schema'
import type { Concept, GrammarPoint, QAItem, Sentence } from '../../src/content/types'

const ROOT = path.resolve(import.meta.dirname, '../..')
const DATA = path.join(ROOT, 'src/content/data')
const OUT = path.join(import.meta.dirname, '.texts.json')

function readDir<S extends z.ZodType>(dir: string, schema: S): Array<z.infer<S>> {
  const full = path.join(DATA, dir)
  if (!fs.existsSync(full)) return []
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      try {
        const r = schema.safeParse(JSON.parse(fs.readFileSync(path.join(full, f), 'utf8')))
        if (r.success) return [r.data]
        console.warn(`skip ${dir}/${f}: does not match the schema`)
      } catch (e) {
        console.warn(`skip ${dir}/${f}: ${(e as Error).message}`)
      }
      return []
    })
}

const out = collectAudioTexts({
  concepts: readDir('lexicon', lexiconFileSchema).flatMap((f) => f.concepts as Concept[]),
  sentences: readDir('sentences', sentenceFileSchema).flatMap((f) => f.sentences as Sentence[]),
  qaItems: readDir('qa', qaFileSchema).flatMap((f) => f.items as QAItem[]),
  grammarPoints: readDir('grammar', grammarFileSchema).flatMap((f) => f.points as GrammarPoint[]),
})
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
for (const lang of ['ckb', 'fa'] as const) {
  const byKind: Record<string, number> = {}
  for (const t of out[lang]) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1
  console.log(`${lang}: ${out[lang].length} texts (${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ')})`)
}
console.log(`wrote ${path.relative(ROOT, OUT)}`)
