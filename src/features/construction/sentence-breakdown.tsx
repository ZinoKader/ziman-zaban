import { Fragment } from 'react'
import type { TargetLang, Token } from '@/content/types'
import { useLocalize } from '@/i18n'
import { cn } from '@/lib/utils'
import { useSettings, type RomanizationMode } from '@/store/settings'
import { morphLabels, stripPunct } from './logic'
import { constructionStrings } from './strings'
import { useShowScript } from '@/components/script-toggle'

export function expandLabel(label: string, abbr: Record<string, string>): string | undefined {
  const pn = /^([123])(SG|PL)$/.exec(label)
  if (pn) return `${abbr[pn[1]]} ${abbr[pn[2]]}`
  return abbr[label]
}

/** Leipzig gloss with grammatical labels in small caps, e.g. Sara-COP.1SG. */
export function MorphGloss({ morph, className }: { morph: string; className?: string }) {
  const s = constructionStrings.use()
  return (
    <span className={cn('font-mono text-[0.7rem] leading-tight text-muted-foreground', className)}>
      {morph.split(/([-=.])/).map((part, i) =>
        /^[123]?[A-Z]+$/.test(part) ? (
          <abbr key={i} title={expandLabel(part, s.abbr)} className="font-semibold tracking-wider text-foreground/75 no-underline">
            {part}
          </abbr>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </span>
  )
}

interface SentenceBreakdownProps {
  lang: TargetLang
  tokens: Token[]
  /** Token indexes to emphasise (e.g. the blank of a cloze, or words the learner got wrong). */
  highlight?: number[]
  /** Defaults to showing romanization unless the learner turned it off entirely. */
  romanization?: RomanizationMode
  /** List the glossing abbreviations used below the table. */
  legend?: boolean
  className?: string
}

/**
 * Interlinear gloss: each word with its romanization, meaning in context and morpheme breakdown,
 * laid out right-to-left in reading order.
 */
export function SentenceBreakdown({ lang, tokens, highlight = [], romanization, legend = true, className }: SentenceBreakdownProps) {
  const s = constructionStrings.use()
  const l = useLocalize()
  const setting = useSettings((st) => st.romanization)
  const showLatin = (romanization ?? (setting === 'never' ? 'never' : 'always')) !== 'never'
  const showScript = useShowScript()
  const labels = [...new Set(tokens.flatMap((t) => (t.morph ? morphLabels(t.morph) : [])))]
  const expanded = labels.map((lb) => [lb, expandLabel(lb, s.abbr)] as const).filter(([, e]) => !!e)

  return (
    <div className={cn('space-y-2', className)}>
      <ol dir={showLatin ? 'ltr' : 'rtl'} className="flex flex-wrap justify-center gap-1.5" aria-label={s.wordByWord}>
        {tokens.map((t, i) => (
          <li
            key={i}
            className={cn(
              'flex min-w-16 flex-col items-center gap-0.5 rounded-xl border bg-background/60 px-2.5 py-2 text-center',
              highlight.includes(i) && 'border-primary/60 bg-primary/5 ring-2 ring-primary/20',
            )}
          >
            {showLatin ? (
              <>
                <span dir="ltr" lang={`${lang}-Latn`} className="text-base font-semibold">
                  {stripPunct(t.latin)}
                </span>
                {showScript && (
                  <span dir="rtl" lang={lang} className="font-script text-base leading-snug text-foreground/75">
                    {stripPunct(t.text)}
                  </span>
                )}
              </>
            ) : (
              <span dir="rtl" lang={lang} className="font-script text-xl font-medium">
                {stripPunct(t.text)}
              </span>
            )}
            <span dir="ltr" className="text-sm leading-tight">
              {l(t.gloss)}
            </span>
            {t.morph && <MorphGloss morph={t.morph} />}
          </li>
        ))}
      </ol>
      {legend && expanded.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          <span className="font-medium">{s.abbreviations}:</span>{' '}
          {expanded.map(([lb, e], i) => (
            <Fragment key={lb}>
              {i > 0 && ' · '}
              <span className="font-mono font-semibold tracking-wider">{lb}</span> {e}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  )
}
