import { Check } from 'lucide-react'
import { Fragment } from 'react'
import { TargetText } from '@/components/target-text'
import type { QAForm, TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { cn } from '@/lib/utils'
import { responseStrings } from '../strings'
import { displayValues, fillAnswer, isTemplate, splitTemplate, type SlotValue } from '../template'

/** A template with its slots drawn as labelled blanks: ناوم [name]ە. */
export function PatternText({ text, lang, latin }: { text: string; lang: TargetLang; latin?: boolean }) {
  const s = responseStrings.use()
  const { parts, slots } = splitTemplate(text)
  return (
    <span
      dir={latin ? 'ltr' : 'rtl'}
      lang={latin ? `${lang}-Latn` : lang}
      className={cn(latin ? 'text-sm text-muted-foreground' : 'font-script text-xl leading-loose')}
    >
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < slots.length && (
            <span
              dir="ltr"
              className="mx-0.5 inline-block rounded-md border border-dashed border-mod-response/50 bg-mod-response/10 px-1.5 align-middle font-sans text-xs font-medium leading-5 text-mod-response"
            >
              {s.slotLabels[slots[i]] ?? slots[i]}
            </span>
          )}
        </Fragment>
      ))}
    </span>
  )
}

interface ModelAnswersProps {
  form: QAForm
  lang: TargetLang
  /** Index of the answer the learner's own answer matched, -1 for none. */
  matchedIndex: number
  own: Record<string, SlotValue | undefined>
}

/** Every model answer, with audio, romanization and translation; templates show their pattern too. */
export function ModelAnswers({ form, lang, matchedIndex, own }: ModelAnswersProps) {
  const s = responseStrings.use()
  const l = useLocalize()
  let templates = 0
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{s.answersTitle}</p>
      <ul className="space-y-2">
        {form.answers.map((answer, i) => {
          const template = isTemplate(answer)
          const filled = fillAnswer(answer, displayValues(form, own, template ? templates++ : 0))
          const matched = i === matchedIndex
          return (
            <li
              key={i}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-xl bg-background/70 px-3 py-3 text-center',
                matched && 'ring-2 ring-success/30',
              )}
            >
              {matched && (
                <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                  <Check className="size-3" />
                  {s.yourMatch}
                </span>
              )}
              {template && (
                <div className={cn('flex flex-col items-center', matched && 'mt-5')}>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.pattern}</span>
                  <PatternText text={answer.text} lang={lang} />
                  <PatternText text={answer.latin} lang={lang} latin />
                </div>
              )}
              {template && <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.forExample}</span>}
              <TargetText
                lang={lang}
                text={filled.text}
                latin={filled.latin}
                size="md"
                audio
                romanization="always"
                className={cn(!template && matched && 'mt-5')}
              />
              <p className="text-sm text-muted-foreground">{l(filled.translation)}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
