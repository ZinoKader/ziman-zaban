import { collectAudioTexts, type AudioText, type TextKind } from '@/content/audio-texts'
import { conceptById, concepts, grammarById, grammarPoints, qaById, qaItems, sentenceById, sentences, units } from '@/content'
import type { Localized, TargetLang } from '@/content/types'
import { canonicalize } from '@/lib/script/normalize'

export type PromptGroup = 'words' | 'sentences' | 'all'

export const GROUP_KINDS: Record<PromptGroup, TextKind[]> = {
  words: ['word'],
  sentences: ['question', 'answer', 'sentence', 'grammar'],
  all: ['word', 'question', 'answer', 'sentence', 'grammar'],
}

const KIND_ORDER: Record<TextKind, number> = { word: 0, question: 1, answer: 2, sentence: 3, grammar: 4 }

export interface Prompt extends AudioText {
  /** What the text means, to tell apart words written alike. */
  meaning?: Localized
  /** True when `meaning` is the question this text answers, not the text itself. */
  answers?: boolean
}

let cache: Record<TargetLang, AudioText[]> | null = null
function allTexts(): Record<TargetLang, AudioText[]> {
  cache ??= collectAudioTexts({ concepts, sentences, qaItems, grammarPoints })
  return cache
}

const unitOrder = new Map(units.map((u, i) => [u.id, i]))
const position = new Map<string, number>([
  ...concepts.map((c, i): [string, number] => [`concept:${c.id}`, i]),
  ...sentences.map((s, i): [string, number] => [`sentence:${s.id}`, i]),
  ...qaItems.map((q, i): [string, number] => [`qa:${q.id}`, i]),
  ...grammarPoints.map((g, i): [string, number] => [`grammar:${g.id}`, i]),
])

function unitOf(ref: string): string | undefined {
  const [kind, id] = ref.split(':')
  if (kind === 'concept') return conceptById.get(id)?.unit
  if (kind === 'sentence') return sentenceById.get(id)?.unit
  if (kind === 'qa') return qaById.get(id)?.unit
  return undefined
}

function meaningOf(t: AudioText, lang: TargetLang): Pick<Prompt, 'meaning' | 'answers'> {
  for (const ref of t.refs) {
    const [kind, id] = ref.split(':')
    if (kind === 'concept') {
      const c = conceptById.get(id)
      if (c) return { meaning: c.gloss }
    } else if (kind === 'sentence') {
      const s = sentenceById.get(id)
      if (s) return { meaning: s.translation }
    } else if (kind === 'qa' && !ref.endsWith(':slot')) {
      const q = qaById.get(id)
      if (!q) continue
      if (t.kind === 'question') return { meaning: q.question }
      const a = q[lang]?.answers.find((x) => canonicalize(x.text, lang) === t.text)
      return a ? { meaning: a.translation } : { meaning: q.question, answers: true }
    } else if (kind === 'grammar') {
      const ex = grammarById.get(id)?.examples.find((x) => canonicalize(x.text, lang) === t.text)
      if (ex) return { meaning: ex.translation }
    }
  }
  return {}
}

/**
 * What to record, in the order a learner meets it: words unit by unit, then questions, answers,
 * sentences and grammar examples. Texts in `skip` (already recorded) are left out.
 */
export function promptsFor(lang: TargetLang, group: PromptGroup, skip: (text: string) => boolean = () => false): Prompt[] {
  const kinds = GROUP_KINDS[group]
  const rank = (t: AudioText) => Math.min(...t.refs.map((r) => unitOrder.get(unitOf(r) ?? '') ?? units.length))
  return allTexts()
    [lang].filter((t) => kinds.includes(t.kind) && !skip(t.text))
    .map((t) => ({ t, kind: KIND_ORDER[t.kind], unit: rank(t), pos: position.get(t.refs[0].replace(/:slot$/, '')) ?? 0 }))
    .sort((a, b) => a.kind - b.kind || a.unit - b.unit || a.pos - b.pos)
    .map(({ t }) => ({ ...t, ...meaningOf(t, lang) }))
}

/** How many texts of a group a language has in total. */
export function promptTotal(lang: TargetLang, group: PromptGroup): number {
  const kinds = GROUP_KINDS[group]
  return allTexts()[lang].filter((t) => kinds.includes(t.kind)).length
}
