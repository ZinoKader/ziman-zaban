import { ArrowRight, GraduationCap, MessagesSquare } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AudioButton } from '@/components/audio-button'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { WordCard } from '@/components/word-card'
import { grammarById, qaFor, sentencesFor, unitById } from '@/content'
import type { Concept, SentenceForm, TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { retrievability, strength, type StoredCard } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { formatDate, formatRelative } from './format'
import { StrengthDot } from './strength-dots'
import { wordsStrings } from './strings'
import { wordCards } from './word-progress'
import { qaUsing, sentencesUsing } from './word-usage'

const EXAMPLES_SHOWN = 4

function SectionTitle({ children, icon: Icon }: { children: ReactNode; icon?: typeof ArrowRight }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </h3>
  )
}

/** A sentence with the tokens that are forms of `conceptId` highlighted. */
function UsageSentence({
  form,
  lang,
  conceptId,
  size = 'md',
}: {
  form: SentenceForm
  lang: TargetLang
  conceptId: string
  size?: 'sm' | 'md'
}) {
  const romanization = useSettings((s) => s.romanization)
  const joined = form.tokens.map((t) => t.text).join(' ')
  if (joined !== form.text) {
    return <TargetText lang={lang} text={form.text} latin={form.latin} size={size} align="start" audio />
  }
  const hit = (id?: string) => id === conceptId
  const script = (
    <p
      dir="rtl"
      lang={lang}
      className={cn(
        'font-script leading-[1.7]',
        romanization === 'never' ? (size === 'md' ? 'text-xl' : 'text-base') : cn('text-foreground/75', size === 'md' ? 'text-base' : 'text-sm'),
      )}
    >
      {form.tokens.map((t, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <span className={cn(hit(t.concept) && 'rounded-md bg-primary/12 px-0.5 font-semibold text-primary')}>{t.text}</span>
        </span>
      ))}
    </p>
  )
  if (romanization === 'never') {
    return (
      <div className="flex items-center gap-1.5">
        {script}
        <AudioButton lang={lang} text={form.text} />
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-1.5">
        <p lang={`${lang}-Latn`} className={cn('font-semibold leading-snug', size === 'md' ? 'text-lg' : 'text-base')}>
          {form.tokens.map((t, i) => (
            <span key={i}>
              {i > 0 && ' '}
              <span className={cn(hit(t.concept) && 'rounded-md bg-primary/12 px-0.5 text-primary')}>{t.latin}</span>
            </span>
          ))}
        </p>
        <AudioButton lang={lang} text={form.text} />
      </div>
      {script}
    </div>
  )
}

function SkillStats({ label, card }: { label: string; card: StoredCard | undefined }) {
  const s = wordsStrings.use()
  const baseLang = useSettings((st) => st.baseLang)
  const level = strength(card)
  const [now] = useState(() => new Date())
  const due = card ? new Date(card.due) : null
  const started = !!card && level !== 'new'
  return (
    <div className="rounded-2xl border bg-background/60 p-3.5">
      <p className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
        {label}
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <StrengthDot level={level} />
          {s.strength[level]}
        </span>
      </p>
      {started && due ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">{s.nextReview}</dt>
          <dd className="text-end font-medium tabular-nums" title={formatDate(due, baseLang)}>
            {formatRelative(due, now, baseLang) ?? s.dueNow}
          </dd>
          <dt className="text-muted-foreground">{s.retention}</dt>
          <dd className="text-end font-medium tabular-nums">{Math.round(retrievability(card, now) * 100)}%</dd>
          <dt className="text-muted-foreground">{s.reps}</dt>
          <dd className="text-end font-medium tabular-nums">{card.reps}</dd>
          <dt className="text-muted-foreground">{s.lapses}</dt>
          <dd className="text-end font-medium tabular-nums">{card.lapses}</dd>
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">{s.notStarted}</p>
      )}
    </div>
  )
}

export function WordDetail({ concept, lang }: { concept: Concept; lang: TargetLang }) {
  const s = wordsStrings.use()
  const l = useLocalize()
  const compare = useSettings((st) => st.compare)
  const cards = useProgress((st) => st.cards)
  const [allExamples, setAllExamples] = useState(false)
  const other: TargetLang = lang === 'ckb' ? 'fa' : 'ckb'
  const unit = unitById.get(concept.unit)

  const examples = useMemo(() => sentencesUsing(sentencesFor(lang), lang, concept.id), [lang, concept.id])
  const questions = useMemo(() => qaUsing(qaFor(lang), lang, concept.id), [lang, concept.id])
  const grammar = useMemo(() => {
    const ids = new Set(examples.flatMap((e) => e[lang]?.grammar ?? []))
    return [...ids].map((id) => grammarById.get(id)).filter((g) => !!g)
  }, [examples, lang])
  const own = wordCards(cards, lang, concept.id)
  const shown = allExamples ? examples : examples.slice(0, EXAMPLES_SHOWN)

  return (
    <article className="flex flex-col gap-8" aria-label={l(concept.gloss)}>
      <WordCard key={`${lang}:${concept.id}`} concept={concept} lang={lang} extras evidence className="pt-2" />

      <section>
        <SectionTitle>{s.yourStats}</SectionTitle>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
          <SkillStats label={s.recognition} card={own.recognition} />
          <SkillStats label={s.recall} card={own.recall} />
        </div>
        <Button asChild variant="secondary" className="mt-3 h-10 w-full justify-between rounded-xl">
          <Link to={`/learn/recognition/session?unit=${encodeURIComponent(concept.unit)}`}>
            <span className="flex min-w-0 items-center gap-2">
              {unit && <span aria-hidden>{unit.emoji}</span>}
              <span className="truncate">
                {s.practiceUnit}
                {unit && <span className="text-muted-foreground"> · {l(unit.title)}</span>}
              </span>
            </span>
            <ArrowRight className="rtl:rotate-180" />
          </Link>
        </Button>
      </section>

      <section>
        <SectionTitle>{s.examples}</SectionTitle>
        {examples.length === 0 ? (
          <p className="text-sm text-muted-foreground">{s.noExamples}</p>
        ) : (
          <ul className="space-y-5">
            {shown.map((sentence) => {
              const form = sentence[lang]!
              const otherForm = compare ? sentence[other] : undefined
              return (
                <li key={sentence.id} className="space-y-1.5 border-s-2 border-primary/25 ps-3.5">
                  <UsageSentence form={form} lang={lang} conceptId={concept.id} />
                  <p className="text-[0.95rem] leading-relaxed">{l(sentence.translation)}</p>
                  {otherForm && (
                    <div className="pt-1 opacity-85">
                      <UsageSentence form={otherForm} lang={other} conceptId={concept.id} size="sm" />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {examples.length > EXAMPLES_SHOWN && !allExamples && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setAllExamples(true)}>
            {s.showAllExamples(examples.length)}
          </Button>
        )}
      </section>

      {grammar.length > 0 && (
        <section>
          <SectionTitle icon={GraduationCap}>{s.grammarUsed}</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {grammar.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/grammar/${g.id}`}
                  className="inline-flex rounded-full border bg-card px-3 py-1 text-sm transition hover:border-primary/50 hover:bg-accent"
                >
                  {l(g.title)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {questions.length > 0 && (
        <section>
          <SectionTitle icon={MessagesSquare}>{s.questions}</SectionTitle>
          <ul className="space-y-3">
            {questions.map((q) => {
              const form = q[lang]!
              const answer = form.answers[0]
              return (
                <li key={q.id} className="space-y-2 rounded-2xl bg-muted/60 p-3.5">
                  <div>
                    <TargetText lang={lang} text={form.question.text} latin={form.question.latin} size="sm" align="start" audio />
                    <p className="text-sm text-muted-foreground">{l(q.question)}</p>
                  </div>
                  {answer && (
                    <div className="border-t border-border/70 pt-2">
                      <TargetText lang={lang} text={answer.text} latin={answer.latin} size="sm" align="start" audio />
                      <p className="text-sm text-muted-foreground">{l(answer.translation)}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </article>
  )
}
