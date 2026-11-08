import { canonicalize } from '@/lib/script/normalize'
import type { Concept, Form, GrammarPoint, QAItem, Sentence, TargetLang } from './types'

export type TextKind = 'word' | 'sentence' | 'question' | 'answer' | 'grammar'

/** One text the app can play, keyed by canonical text. `refs` are `concept:id`, `sentence:id`, `qa:id` or `grammar:id`. */
export interface AudioText {
  text: string
  latin: string
  kind: TextKind
  refs: string[]
}

export interface AudioTextSources {
  concepts: Concept[]
  sentences: Sentence[]
  qaItems: QAItem[]
  grammarPoints: GrammarPoint[]
}

/** Lower number wins when the same text appears in several roles. */
const KIND_PRIORITY: Record<TextKind, number> = { question: 0, word: 1, answer: 2, sentence: 3, grammar: 4 }
const MAX_SLOT_WORDS = 3
const SLOT = /\{[a-zA-Z][\w-]*\}/g
const HAS_SLOT = /\{[a-zA-Z][\w-]*\}/
const LANGS = ['ckb', 'fa'] as const

const wordCount = (s: string) => s.trim().split(/\s+/).length

/** Every target-language text the app can play: words, sentences, questions, filled answers and grammar examples. */
export function collectAudioTexts({ concepts, sentences, qaItems, grammarPoints }: AudioTextSources): Record<TargetLang, AudioText[]> {
  const texts: Record<TargetLang, Map<string, AudioText>> = { ckb: new Map(), fa: new Map() }

  const add = (lang: TargetLang, raw: { text?: string; script?: string; latin: string } | undefined, kind: TextKind, ref: string) => {
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

  for (const c of concepts)
    for (const lang of LANGS) {
      const e = c[lang]
      if (!e) continue
      for (const f of [e.primary, ...(e.variants ?? []), e.plural].filter(Boolean) as Form[]) add(lang, f, 'word', `concept:${c.id}`)
    }

  for (const s of sentences)
    for (const lang of LANGS) {
      const f = s[lang]
      if (!f) continue
      for (const v of [f, f.colloquial, ...(f.alternatives ?? [])]) add(lang, v, 'sentence', `sentence:${s.id}`)
    }

  for (const q of qaItems)
    for (const lang of LANGS) {
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
          const fill = (tpl: string, key: 'text' | 'latin') => tpl.replace(SLOT, (m) => pick(m.slice(1, -1))?.[key] ?? m)
          add(lang, { text: fill(a.text, 'text'), latin: fill(a.latin, 'latin') }, 'answer', ref)
        }
      }
      for (const [, values] of slots)
        for (const v of values) if (wordCount(v.text) <= MAX_SLOT_WORDS) add(lang, v, 'word', `${ref}:slot`)
    }

  for (const g of grammarPoints) for (const ex of g.examples) add(g.lang, ex, 'grammar', `grammar:${g.id}`)

  return {
    ckb: [...texts.ckb.values()].sort((a, b) => a.text.localeCompare(b.text)),
    fa: [...texts.fa.values()].sort((a, b) => a.text.localeCompare(b.text)),
  }
}
