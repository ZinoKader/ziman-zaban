import { Link2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { evidenceFor } from '@/content'
import type { Concept, Form, TargetLang } from '@/content/types'
import { defineStrings, useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { EvidenceBadge } from './evidence-badge'
import { useShowScript } from './script-toggle'
import { TargetText } from './target-text'

const strings = defineStrings({
  en: {
    also: 'Also:',
    otherForms: (n: number) => (n === 1 ? '1 other way to say it' : `${n} other ways to say it`),
    plural: 'Plural',
    inOther: { ckb: 'In Sorani', fa: 'In Persian' },
    cognate: 'Related words',
  },
  sv: {
    also: 'Även:',
    otherForms: (n: number) => (n === 1 ? '1 annat sätt att säga det' : `${n} andra sätt att säga det`),
    plural: 'Plural',
    inOther: { ckb: 'På sorani', fa: 'På persiska' },
    cognate: 'Besläktade ord',
  },
})

/** Other accepted forms, folded away behind a small link: "2 other ways to say it". */
export function AlsoLine({ forms, lang, className }: { forms: Form[]; lang: TargetLang; className?: string }) {
  const s = strings.use()
  const c = common.use()
  const romanization = useSettings((st) => st.romanization)
  const showScript = useShowScript()
  const [open, setOpen] = useState(false)
  if (!forms.length) return null
  const latin = romanization === 'always'
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('self-center rounded-md px-1.5 py-0.5 text-xs text-muted-foreground/80 transition hover:bg-muted hover:text-foreground', className)}
      >
        + {s.otherForms(forms.length)}
      </button>
    )
  return (
    <p className={cn('text-xs leading-relaxed text-muted-foreground text-balance', className)}>
      <span className="me-1">{s.also}</span>
      {forms.map((f, i) => (
        <Fragment key={f.script}>
          {i > 0 && <span aria-hidden> · </span>}
          <span className="inline-flex items-baseline gap-1">
            {latin && (
              <span lang={`${lang}-Latn`} className="font-medium text-foreground/80">
                {f.latin}
              </span>
            )}
            {(!latin || showScript) && (
              <span dir="rtl" lang={lang} className={cn('font-script', !latin && 'text-foreground/80')}>
                {f.script}
              </span>
            )}
            {f.register && f.register !== 'neutral' && <span className="italic">{c.register[f.register]}</span>}
          </span>
        </Fragment>
      ))}
    </p>
  )
}

/** Whether `WordExtras` has anything to show. */
export function hasWordExtras(concept: Concept, lang: TargetLang, compare: boolean): boolean {
  const entry = concept[lang]
  if (!entry) return false
  const other: TargetLang = lang === 'ckb' ? 'fa' : 'ckb'
  return !!entry.notes || !!entry.plural || !!entry.variants?.some((v) => v.note) || (compare && !!concept[other])
}

/** The secondary facts about a word: notes, plural, variant notes and the word in the other language. */
export function WordExtras({ concept, lang, className }: { concept: Concept; lang: TargetLang; className?: string }) {
  const s = strings.use()
  const l = useLocalize()
  const compare = useSettings((st) => st.compare)
  const showScript = useShowScript()
  const entry = concept[lang]
  if (!entry || !hasWordExtras(concept, lang, compare)) return null
  const other: TargetLang = lang === 'ckb' ? 'fa' : 'ckb'
  const otherEntry = compare ? concept[other] : undefined
  const notedVariants = (entry.variants ?? []).filter((v) => v.note)

  return (
    <div className={cn('flex w-full flex-col gap-3 text-start', className)}>
      {entry.notes && <p className="text-sm leading-relaxed">{l(entry.notes)}</p>}
      {notedVariants.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {notedVariants.map((v) => (
            <li key={v.script}>
              <span lang={`${lang}-Latn`} className="font-medium text-foreground/80">
                {v.latin}
              </span>{' '}
              {showScript && (
                <span dir="rtl" lang={lang} className="font-script">
                  {v.script}
                </span>
              )}
              : {l(v.note!)}
            </li>
          ))}
        </ul>
      )}
      {entry.plural && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{s.plural}</span>
          <TargetText lang={lang} text={entry.plural.script} latin={entry.plural.latin} size="sm" align="start" className="items-end" />
        </div>
      )}
      {otherEntry && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {concept.cognate && <Link2 className="size-3.5" aria-label={s.cognate} />}
            {s.inOther[other]}
          </span>
          <TargetText
            lang={other}
            text={otherEntry.primary.script}
            latin={otherEntry.primary.latin}
            size="sm"
            align="start"
            className="items-end"
            audio
          />
        </div>
      )}
    </div>
  )
}

interface WordCardProps {
  concept: Concept
  lang: TargetLang
  /** Show the meaning (hidden while the learner still has to answer). */
  showMeaning?: boolean
  autoPlay?: boolean
  size?: 'md' | 'lg'
  /** Show notes, plural and the other language under the word instead of leaving them to the caller. */
  extras?: boolean
  /** Show how the word was verified. Only on reference pages, never during practice. */
  evidence?: boolean
  className?: string
}

/** A word at a glance: its form and pronunciation, its meaning and, quietly, the other ways to say it. */
export function WordCard({
  concept,
  lang,
  showMeaning = true,
  autoPlay = false,
  size = 'lg',
  extras = false,
  evidence = false,
  className,
}: WordCardProps) {
  const l = useLocalize()
  const c = common.use()
  const entry = concept[lang]
  if (!entry) return null
  const audioUrl = entry.audio?.[0]?.url ?? evidenceFor('concept', lang, concept.id).audio

  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      {concept.emoji && (
        <div className={cn(size === 'lg' ? 'text-5xl' : 'text-3xl')} aria-hidden>
          {concept.emoji}
        </div>
      )}
      <TargetText
        lang={lang}
        text={entry.primary.script}
        latin={entry.primary.latin}
        size={size === 'lg' ? '2xl' : 'xl'}
        audio
        audioUrl={audioUrl}
        autoPlay={autoPlay}
      />
      {entry.primary.register && entry.primary.register !== 'neutral' && (
        <span className="-mt-2 text-xs italic text-muted-foreground">{c.register[entry.primary.register]}</span>
      )}
      {evidence && <EvidenceBadge kind="concept" lang={lang} id={concept.id} showLabel className="-mt-1 opacity-80" />}

      {showMeaning && (
        <div className="space-y-1">
          <p className={cn('font-semibold text-balance', size === 'lg' ? 'text-2xl' : 'text-xl')}>{l(concept.gloss)}</p>
          {concept.senseNote && <p className="text-sm text-muted-foreground">{l(concept.senseNote)}</p>}
        </div>
      )}

      {showMeaning && <AlsoLine forms={entry.variants ?? []} lang={lang} className="max-w-md" />}

      {showMeaning && extras && <WordExtras concept={concept} lang={lang} className="mt-2 max-w-md rounded-2xl bg-muted/50 p-4" />}
    </div>
  )
}
