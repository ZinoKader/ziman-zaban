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
import { grammarFileSchema, lexiconFileSchema, qaFileSchema, sentenceFileSchema } from '../../src/content/schema'
import type { Concept, Form, GrammarPoint, QAItem, Sentence, TargetLang } from '../../src/content/types'
import { canonicalize } from '../../src/lib/script/normalize'

const ROOT = path.resolve(import.meta.dirname, '../..')
const DATA = path.join(ROOT, 'src/content/data')
const OUT = path.join(import.meta.dirname, '.texts.json')

export type TextKind = 'word' | 'sentence' | 'question' | 'answer' | 'grammar'

interface TextEntry {
  text: string
  latin: string
  kind: TextKind
  refs: string[]
}

/** Lower number wins when the same text appears in several roles. */
const KIND_PRIORITY: Record<TextKind, number> = { question: 0, word: 1, answer: 2, sentence: 3, grammar: 4 }
const MAX_SLOT_WORDS = 3
const SLOT = /\{[a-zA-Z][\w-]*\}/g
const HAS_SLOT = /\{[a-zA-Z][\w-]*\}/

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

const texts: Record<TargetLang, Map<string, TextEntry>> = { ckb: new Map(), fa: new Map() }

function add(lang: TargetLang, raw: { text?: string; script?: string; latin: string } | undefined, kind: TextKind, ref: string) {
  const source = raw?.script ?? raw?.text
  if (!raw || !source || HAS_SLOT.test(source)) return
  const text = canonicalize(source, lang)
  if (!text) return
  const prev = texts[lang].get(text)
  if (!prev) {
    texts[lang].set(text, { text, latin: raw.latin, kind, refs: [ref] })
    return
  }
  if (!prev.refs.includes(ref)) prev.refs.push(ref)
  if (KIND_PRIORITY[kind] < KIND_PRIORITY[prev.kind]) prev.kind = kind
}

const wordCount = (s: string) => s.trim().split(/\s+/).length

for (const file of readDir('lexicon', lexiconFileSchema))
  for (const c of file.concepts as Concept[])
    for (const lang of ['ckb', 'fa'] as const) {
      const e = c[lang]
      if (!e) continue
      const ref = `concept:${c.id}`
      for (const f of [e.primary, ...(e.variants ?? []), e.plural].filter(Boolean) as Form[]) add(lang, f, 'word', ref)
    }

for (const file of readDir('sentences', sentenceFileSchema))
  for (const s of file.sentences as Sentence[])
    for (const lang of ['ckb', 'fa'] as const) {
      const f = s[lang]
      if (!f) continue
      const ref = `sentence:${s.id}`
      for (const v of [f, f.colloquial, ...(f.alternatives ?? [])]) add(lang, v, 'sentence', ref)
    }

for (const file of readDir('qa', qaFileSchema))
  for (const q of file.items as QAItem[])
    for (const lang of ['ckb', 'fa'] as const) {
      const f = q[lang]
      if (!f) continue
      const ref = `qa:${q.id}`
      for (const v of [f.question, f.question.colloquial, ...(f.question.alternatives ?? [])]) add(lang, v, 'question', ref)
      const slots = Object.entries(f.slots ?? {})
      for (const a of f.answers) {
        if (!HAS_SLOT.test(a.text)) {
          add(lang, a, 'answer', ref)
          continue
        }
        // Example fills are what the exercise shows before the learner enters their own details.
        const n = Math.max(0, ...slots.map(([, v]) => v.length))
        for (let i = 0; i < n; i++) {
          const pick = (name: string) => {
            const values = f.slots?.[name] ?? []
            return values.length ? values[i % values.length] : undefined
          }
          const fill = (tpl: string, key: 'text' | 'latin') =>
            tpl.replace(SLOT, (m) => pick(m.slice(1, -1))?.[key] ?? m)
          add(lang, { text: fill(a.text, 'text'), latin: fill(a.latin, 'latin') }, 'answer', ref)
        }
      }
      for (const [, values] of slots)
        for (const v of values) if (wordCount(v.text) <= MAX_SLOT_WORDS) add(lang, v, 'word', `${ref}:slot`)
    }

for (const file of readDir('grammar', grammarFileSchema))
  for (const g of file.points as GrammarPoint[]) for (const ex of g.examples) add(g.lang, ex, 'grammar', `grammar:${g.id}`)

const out = Object.fromEntries(
  (['ckb', 'fa'] as const).map((lang) => [
    lang,
    [...texts[lang].values()].sort((a, b) => a.text.localeCompare(b.text)),
  ]),
)
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
for (const lang of ['ckb', 'fa'] as const) {
  const byKind: Record<string, number> = {}
  for (const t of texts[lang].values()) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1
  console.log(`${lang}: ${texts[lang].size} texts (${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ')})`)
}
console.log(`wrote ${path.relative(ROOT, OUT)}`)
