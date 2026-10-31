import { TargetText } from '@/components/target-text'
import { AlsoLine, WordExtras, hasWordExtras } from '@/components/word-card'
import { acceptedForms, evidenceFor } from '@/content'
import type { Concept, Form, TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { recallStrings } from '../strings'

interface AnswerDetailsProps {
  concept: Concept
  lang: TargetLang
  /** The form to feature: the one the learner matched, or the primary form. */
  shown: Form
  /** Small label above the featured form, e.g. "Correct answer". */
  caption?: string
  autoPlay?: boolean
}

/** The correct answer, big, with audio; plus the most common form if the learner used another one. */
export function AnswerDetails({ concept, lang, shown, caption, autoPlay = false }: AnswerDetailsProps) {
  const s = recallStrings.use()
  const c = common.use()
  const l = useLocalize()
  const entry = concept[lang]!
  const primary = entry.primary
  const audioUrl = shown === primary ? (entry.audio?.[0]?.url ?? evidenceFor('concept', lang, concept.id).audio) : undefined

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex flex-col items-center gap-1">
        {caption && <p className="text-xs font-medium text-muted-foreground">{caption}</p>}
        <TargetText
          lang={lang}
          text={shown.script}
          latin={shown.latin}
          size="xl"
          audio
          audioUrl={audioUrl}
          autoPlay={autoPlay}
          romanization="always"
        />
        {shown.register && shown.register !== 'neutral' && (
          <span className="text-xs italic text-muted-foreground">{c.register[shown.register]}</span>
        )}
        {shown.note && <p className="text-xs text-muted-foreground">{l(shown.note)}</p>}
      </div>

      {shown !== primary && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-muted-foreground">{s.variantUsed}</p>
          <TargetText lang={lang} text={primary.script} latin={primary.latin} size="sm" audio romanization="always" />
        </div>
      )}
    </div>
  )
}

/** Whether `AnswerExtras` has anything to show. */
export function hasAnswerExtras(concept: Concept, lang: TargetLang, shown: Form, compare: boolean): boolean {
  return answerAlternatives(concept, lang, shown).length > 0 || hasWordExtras(concept, lang, compare)
}

function answerAlternatives(concept: Concept, lang: TargetLang, shown: Form): Form[] {
  const entry = concept[lang]!
  return acceptedForms(entry).filter((f) => f !== shown && f !== entry.primary)
}

/** What helps remember the word, for after the verdict: other accepted forms, notes and the other language. */
export function AnswerExtras({ concept, lang, shown }: { concept: Concept; lang: TargetLang; shown: Form }) {
  return (
    <>
      <AlsoLine forms={answerAlternatives(concept, lang, shown)} lang={lang} />
      <WordExtras concept={concept} lang={lang} />
    </>
  )
}
