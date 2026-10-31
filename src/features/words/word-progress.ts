import type { TargetLang } from '@/content/types'
import { cardKey, strength, type CardKey, type StoredCard, type Strength } from '@/lib/srs'

export const STRENGTHS: Strength[] = ['new', 'learning', 'young', 'mature']

export interface WordStrength {
  recognition: Strength
  recall: Strength
  /** The further of the two: a word counts as started once either card is. */
  overall: Strength
}

type Cards = Partial<Record<CardKey, StoredCard>>

export function wordCards(cards: Cards, lang: TargetLang, id: string) {
  return {
    recognition: cards[cardKey(lang, 'recognition', id)],
    recall: cards[cardKey(lang, 'recall', id)],
  }
}

export function wordStrength(cards: Cards, lang: TargetLang, id: string): WordStrength {
  const c = wordCards(cards, lang, id)
  const recognition = strength(c.recognition)
  const recall = strength(c.recall)
  const overall = STRENGTHS[Math.max(STRENGTHS.indexOf(recognition), STRENGTHS.indexOf(recall))]
  return { recognition, recall, overall }
}
