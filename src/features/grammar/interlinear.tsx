import { Fragment } from 'react'
import { TargetText } from '@/components/target-text'
import type { Localized, TargetLang, Token } from '@/content/types'
import { useLocalize } from '@/i18n'
import { useSettings } from '@/store/settings'
import { grammarStrings } from './strings'
import { useShowScript } from '@/components/script-toggle'

/** A Leipzig-style gloss such as `DUR-eat.PRS-3PL`, with the grammatical labels explained on hover. */
export function MorphGloss({ morph }: { morph: string }) {
  const s = grammarStrings.use()
  return (
    <span className="text-[0.7rem] tracking-wide text-muted-foreground">
      {morph.split(/([-.=])/).map((part, i) => {
        const person = part.match(/^([123])(SG|PL)$/)
        const title = person ? s.person(person[1], person[2]) : /^[A-Z]+$/.test(part) ? s.morph[part] : undefined
        if (!title) return <Fragment key={i}>{part}</Fragment>
        return (
          <abbr key={i} title={title} className="cursor-help font-semibold no-underline [font-variant-caps:all-small-caps]">
            {part}
          </abbr>
        )
      })}
    </span>
  )
}

/** Each word of a sentence stacked as romanization / script / meaning / morphology, in the reading order of the leading line. */
export function Interlinear({ tokens, lang }: { tokens: Token[]; lang: TargetLang }) {
  const l = useLocalize()
  const romanization = useSettings((st) => st.romanization)
  const showScript = useShowScript()
  return (
    <ol dir={romanization === 'never' ? 'rtl' : 'ltr'} className="flex flex-wrap justify-start gap-x-5 gap-y-3">
      {tokens.map((t, i) => (
        <li key={i} className="flex flex-col items-center text-center">
          {romanization === 'never' ? (
            <span lang={lang} className="font-script text-lg leading-[1.6]">
              {t.text}
            </span>
          ) : (
            <>
              <span dir="ltr" lang={`${lang}-Latn`} className="text-sm font-semibold">
                {t.latin}
              </span>
              {showScript && (
                <span lang={lang} className="font-script text-sm leading-[1.6] text-foreground/75">
                  {t.text}
                </span>
              )}
            </>
          )}
          <span dir="ltr" className="text-xs font-medium">
            {l(t.gloss)}
          </span>
          {t.morph && (
            <span dir="ltr">
              <MorphGloss morph={t.morph} />
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

interface ExampleProps {
  text: string
  latin: string
  translation: Localized
  tokens?: Token[]
  lang: TargetLang
}

export function GrammarExampleView({ text, latin, translation, tokens, lang }: ExampleProps) {
  const s = grammarStrings.use()
  const l = useLocalize()
  return (
    <figure className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <TargetText lang={lang} text={text} latin={latin} size="md" align="start" audio />
      <figcaption className="text-[0.95rem] leading-relaxed">{l(translation)}</figcaption>
      {tokens && tokens.length > 0 && (
        <details className="group border-t pt-3" open>
          <summary className="mb-2 cursor-pointer list-none text-xs font-medium uppercase tracking-wider text-muted-foreground select-none marker:hidden">
            <span className="me-1 inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden>
              ›
            </span>
            {s.wordByWord}
          </summary>
          <Interlinear tokens={tokens} lang={lang} />
        </details>
      )}
    </figure>
  )
}
