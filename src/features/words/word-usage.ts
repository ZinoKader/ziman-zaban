import type { QAItem, Sentence, TargetLang, Token } from '@/content/types'

const uses = (tokens: Token[] | undefined, id: string) => !!tokens?.some((t) => t.concept === id)

/** Course sentences whose tokens in `lang` link to the concept. */
export function sentencesUsing(sentences: Sentence[], lang: TargetLang, id: string): Sentence[] {
  return sentences.filter((s) => uses(s[lang]?.tokens, id))
}

/** Q&A items where the question or one of the model answers in `lang` uses the concept. */
export function qaUsing(items: QAItem[], lang: TargetLang, id: string): QAItem[] {
  return items.filter((q) => {
    const form = q[lang]
    return !!form && (uses(form.question.tokens, id) || form.answers.some((a) => uses(a.tokens, id)))
  })
}
