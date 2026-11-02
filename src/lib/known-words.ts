import { conceptsFor, qaFor, sentencesFor } from '@/content'
import type { TargetLang, Token } from '@/content/types'
import { foldForMatch } from '@/lib/script/normalize'
import { cardKey, type CardKey, type StoredCard } from '@/lib/srs'

type Cards = Partial<Record<CardKey, StoredCard>>

export interface KnownWords {
  /** The concept has been introduced in Recognition. */
  concept: (id: string) => boolean
  /** Every word of the text is one the learner has met. */
  text: (text: string) => boolean
  /** A tagged token is known when its concept is; an untagged one when the word itself is. */
  token: (t: Token) => boolean
}

const words = (text: string, lang: TargetLang) =>
  text
    .split(/\s+/u)
    .map((w) => foldForMatch(w, lang))
    .filter(Boolean)

/**
 * The words a learner has met: the main form of every concept introduced in Recognition, and every
 * inflected form of it that appears as a tagged token in a sentence or answer. Variants (such as the
 * formal خدانگهدار next to خداحافظ) are only listed in small print on the word card, so they don't
 * count. Used to keep Q&A options to words the learner has seen; untagged text counts only when each
 * word is in this set.
 */
export function knownWords(lang: TargetLang, cards: Cards): KnownWords {
  const introduced = new Set(
    conceptsFor(lang)
      .filter((c) => cards[cardKey(lang, 'recognition', c.id)])
      .map((c) => c.id),
  )
  const seen = new Set<string>()
  for (const c of conceptsFor(lang)) {
    if (introduced.has(c.id)) for (const w of words(c[lang]!.primary.script, lang)) seen.add(w)
  }
  const addTokens = (tokens: Token[] | undefined) => {
    for (const t of tokens ?? []) if (t.concept && introduced.has(t.concept)) for (const w of words(t.text, lang)) seen.add(w)
  }
  for (const s of sentencesFor(lang)) addTokens(s[lang]?.tokens)
  for (const q of qaFor(lang)) {
    addTokens(q[lang]?.question.tokens)
    for (const a of q[lang]?.answers ?? []) addTokens(a.tokens)
  }

  const text = (t: string) => {
    const ws = words(t, lang)
    return ws.length > 0 && ws.every((w) => seen.has(w))
  }
  return {
    concept: (id) => introduced.has(id),
    text,
    token: (t) => (t.concept ? introduced.has(t.concept) : text(t.text)),
  }
}
