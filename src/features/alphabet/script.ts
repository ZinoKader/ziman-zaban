import { concepts as allConcepts, evidenceFor } from '@/content'
import type { Concept, Form, TargetLang } from '@/content/types'
import type { Letter } from './letters'

const ZWJ = '\u200D'

export type Position = 'isolated' | 'initial' | 'medial' | 'final'

/**
 * Positional shapes, produced by surrounding the letter with zero-width joiners so the
 * font's own shaping draws them. Letters that never join to the left have no initial
 * or medial shape: they look isolated or final.
 */
export function contextualForms(letter: Letter): Array<{ position: Position; text: string }> {
  const c = letter.char
  if (!letter.joinsLeft) {
    return [
      { position: 'isolated', text: c },
      { position: 'final', text: ZWJ + c },
    ]
  }
  return [
    { position: 'isolated', text: c },
    { position: 'initial', text: c + ZWJ },
    { position: 'medial', text: ZWJ + c + ZWJ },
    { position: 'final', text: ZWJ + c },
  ]
}

const PUNCTUATION = /[؟?!.,،؛:«»"]/g

function isWordStart(text: string, i: number): boolean {
  return i === 0 || /\s/.test(text[i - 1])
}

/** Indexes where the letter occurs. A single Sorani و that is half of a وو does not count. */
export function letterPositions(text: string, letter: Letter, lang: TargetLang): number[] {
  const word = text.normalize('NFC')
  const target = letter.char
  const found: number[] = []
  for (let i = word.indexOf(target); i >= 0; i = word.indexOf(target, i + 1)) {
    if (lang === 'ckb' && target === 'و' && (word[i - 1] === 'و' || word[i + 1] === 'و')) continue
    found.push(i)
  }
  return found
}

/** Sorani vowels at the start of a word sit on ئ, so ئێ in ئێوە still counts as word-initial ê. */
function startsWord(text: string, i: number, letter: Letter, lang: TargetLang): boolean {
  if (isWordStart(text, i)) return true
  const vowelish = letter.role === 'vowel' || letter.role === 'both'
  return lang === 'ckb' && vowelish && i > 0 && text[i - 1] === 'ئ' && isWordStart(text, i - 1)
}

export interface LetterExample {
  concept: Concept
  form: Form
  initial: boolean
  audioUrl?: string
}

/**
 * The example word for a letter: the shortest single word in the course lexicon that
 * contains it, preferring words that start with it. Multi-word phrases are a last resort.
 */
export function pickExample(
  letter: Letter,
  lang: TargetLang,
  pool: Concept[] = allConcepts,
): LetterExample | undefined {
  let best: { rank: [number, number, number]; example: LetterExample } | undefined
  for (const concept of pool) {
    const entry = concept[lang]
    if (!entry) continue
    const form = entry.primary
    const text = form.script.normalize('NFC')
    const positions = letterPositions(text, letter, lang)
    if (!positions.length) continue
    const initial = positions.some((i) => startsWord(text, i, letter, lang))
    const bare = text.replace(PUNCTUATION, '')
    const rank: [number, number, number] = [/\s/.test(bare.trim()) ? 1 : 0, initial ? 0 : 1, bare.length]
    if (!best || compareRank(rank, best.rank) < 0) {
      best = {
        rank,
        example: { concept, form, initial, audioUrl: entry.audio?.[0]?.url ?? evidenceFor('concept', lang, concept.id).audio },
      }
    }
  }
  return best?.example
}

function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}
