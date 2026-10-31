import { Flag } from 'lucide-react'
import type { ReactNode } from 'react'
import { EvidenceBadge } from '@/components/evidence-badge'
import { TargetText } from '@/components/target-text'
import { Badge } from '@/components/ui/badge'
import { conceptById, grammarById, qaById, sentenceById, unitById, type Evidence } from '@/content'
import type { Form, Gloss, Localized, SourceClaim, TargetLang, Token } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import type { ContentReport } from '@/store/progress'
import type { QueueItem } from './queue'
import { reviewStrings } from './strings'

function Section({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-2', className)}>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** Both base languages: reviewers may only know one of them, and both are shown to learners. */
function Meaning({ value, note }: { value: Gloss | Localized; note?: Localized }) {
  const s = reviewStrings.use()
  const alt = (lang: 'en' | 'sv') => (value as Gloss)[lang === 'en' ? 'enAlt' : 'svAlt']
  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5">
      {(['en', 'sv'] as const).map((lang) => (
        <div key={lang} className="contents">
          <dt className="text-xs font-semibold uppercase text-muted-foreground">{lang}</dt>
          <dd lang={lang} className="text-lg font-medium leading-snug">
            {value[lang]}
            {note && <span className="ms-2 text-sm font-normal text-muted-foreground">{note[lang]}</span>}
            {alt(lang)?.length ? (
              <span className="block text-sm font-normal text-muted-foreground">
                {s.alsoAccepted}: {alt(lang)!.join(', ')}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const capitalize = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

function FormTags({ form }: { form: Form }) {
  const c = common.use()
  return (
    <>
      {form.register && form.register !== 'neutral' && (
        <Badge variant="outline" className="font-normal">
          {c.register[form.register]}
        </Badge>
      )}
      {form.dialect && (
        <Badge variant="secondary" className="font-normal">
          {capitalize(form.dialect)}
        </Badge>
      )}
    </>
  )
}

function FormRow({ lang, form, label }: { lang: TargetLang; form: Form; label?: string }) {
  const l = useLocalize()
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
        <FormTags form={form} />
        {form.note && <span className="text-xs text-muted-foreground">{l(form.note)}</span>}
        {form.ipa && <span className="font-mono text-xs text-muted-foreground">/{form.ipa}/</span>}
      </div>
      <TargetText lang={lang} text={form.script} latin={form.latin} size="sm" audio romanization="always" align="start" className="shrink-0 items-end" />
    </li>
  )
}

function Plain({ lang, text, latin, translation }: { lang: TargetLang; text: string; latin: string; translation?: Localized }) {
  const l = useLocalize()
  return (
    <div className="rounded-xl border bg-background/60 px-3 py-2">
      <TargetText lang={lang} text={text} latin={latin} size="md" audio romanization="always" align="start" className="items-end" />
      {translation && <p className="mt-1 text-sm text-muted-foreground">{l(translation)}</p>}
    </div>
  )
}

export function TokenBreakdown({ lang, tokens }: { lang: TargetLang; tokens: Token[] }) {
  const l = useLocalize()
  return (
    <ol dir="rtl" className="flex flex-wrap gap-1.5">
      {tokens.map((t, i) => (
        <li key={`${i}-${t.text}`} className="flex min-w-16 flex-col items-center gap-0.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-center">
          <span lang={lang} className="font-script text-xl leading-relaxed">
            {t.text}
          </span>
          <span dir="ltr" lang={`${lang}-Latn`} className="text-xs font-medium text-muted-foreground">
            {t.latin}
          </span>
          <span dir="ltr" className="text-xs">
            {l(t.gloss)}
          </span>
          {t.morph && (
            <span dir="ltr" className="font-mono text-[0.65rem] tracking-tight text-muted-foreground">
              {t.morph}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

function EvidencePanel({ item, lang, sources }: { item: QueueItem; lang: TargetLang; sources: SourceClaim[] }) {
  const s = reviewStrings.use()
  const ev: Evidence = item.evidence
  return (
    <Section title={s.evidence}>
      <div className="space-y-2 rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
        <EvidenceBadge kind={item.kind} lang={lang} id={item.id} showLabel className="-ms-1.5" />
        {ev.checks.length ? (
          <ul className="list-disc space-y-0.5 ps-5 text-xs" lang="en">
            {ev.checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{s.noChecks}</p>
        )}
        {ev.ipa && <p className="font-mono text-xs text-muted-foreground">IPA {ev.ipa}</p>}
        {sources.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {s.sources}:{' '}
            {sources.map((src) => `${s.sourceNames[src.source] ?? src.source}${src.ref ? ` (${src.ref})` : ''}`).join(' · ')}
          </p>
        )}
      </div>
    </Section>
  )
}

function ReportedBanner({ reports }: { reports: ContentReport[] }) {
  const s = reviewStrings.use()
  return (
    <div className="rounded-xl border border-warning/60 bg-warning/10 px-3 py-2.5 text-sm" role="note">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-800 dark:text-warning">
        <Flag className="size-4" /> {s.reportedTitle(reports.length)}
      </p>
      <ul className="space-y-1">
        {reports.map((r) => (
          <li key={r.at} className="text-sm">
            <span dir="auto">“{r.message}”</span>{' '}
            <time className="text-xs text-muted-foreground" dateTime={r.at}>
              {r.at.slice(0, 10)}
            </time>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Header({ item, extra, reported }: { item: QueueItem; extra?: ReactNode; reported: boolean }) {
  const s = reviewStrings.use()
  const l = useLocalize()
  const unit = unitById.get(item.unit)
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge variant="secondary">{s.kind[item.kind]}</Badge>
      {unit && (
        <Badge variant="outline" className="font-normal">
          <span aria-hidden>{unit.emoji}</span> {l(unit.title)}
        </Badge>
      )}
      <Badge variant="outline" className="font-normal">
        {item.level}
      </Badge>
      {extra}
      {reported && (
        <Badge className="bg-warning text-amber-950">
          <Flag /> {s.reported}
        </Badge>
      )}
      <code className="ms-auto truncate font-mono text-[0.65rem] text-muted-foreground" title={item.key}>
        {item.id}
      </code>
    </div>
  )
}

interface ItemViewProps {
  item: QueueItem
  lang: TargetLang
  reports: ContentReport[]
}

/** Everything a reviewer needs to judge one item, in the order they would check it. */
export function ReviewItemView({ item, lang, reports }: ItemViewProps) {
  if (item.kind === 'concept') return <ConceptView item={item} lang={lang} reports={reports} />
  if (item.kind === 'sentence') return <SentenceView item={item} lang={lang} reports={reports} />
  return <QAView item={item} lang={lang} reports={reports} />
}

function ConceptView({ item, lang, reports }: ItemViewProps) {
  const s = reviewStrings.use()
  const l = useLocalize()
  const concept = conceptById.get(item.id)
  const entry = concept?.[lang]
  if (!concept || !entry) return null
  const audioUrl = entry.audio?.[0]?.url ?? item.evidence.audio
  const ipa = entry.primary.ipa ?? item.evidence.ipa
  const stems = [
    entry.plural && { label: s.plural, form: entry.plural },
    entry.presentStem && { label: s.presentStem, form: entry.presentStem },
    entry.pastStem && { label: s.pastStem, form: entry.pastStem },
  ].filter(Boolean) as Array<{ label: string; form: Form }>

  return (
    <div className="space-y-5">
      <Header
        item={item}
        reported={reports.length > 0}
        extra={
          <Badge variant="outline" className="font-normal">
            {s.pos[concept.pos]}
          </Badge>
        }
      />
      {reports.length > 0 && <ReportedBanner reports={reports} />}
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        {concept.emoji && (
          <span className="text-4xl" aria-hidden>
            {concept.emoji}
          </span>
        )}
        <TargetText lang={lang} text={entry.primary.script} latin={entry.primary.latin} size="2xl" audio audioUrl={audioUrl} romanization="always" />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <FormTags form={entry.primary} />
          {ipa && <span className="font-mono text-xs text-muted-foreground">/{ipa}/</span>}
        </div>
      </div>
      <Section title={s.meaning}>
        <Meaning value={concept.gloss} note={concept.senseNote} />
      </Section>
      {entry.variants?.length ? (
        <Section title={s.variants}>
          <ul className="space-y-1.5">
            {entry.variants.map((v) => (
              <FormRow key={v.script + v.latin} lang={lang} form={v} />
            ))}
          </ul>
        </Section>
      ) : null}
      {stems.length > 0 && (
        <ul className="space-y-1.5">
          {stems.map(({ label, form }) => (
            <FormRow key={label} lang={lang} form={form} label={label} />
          ))}
        </ul>
      )}
      {entry.notes && (
        <Section title={s.notes}>
          <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm leading-relaxed">{l(entry.notes)}</p>
        </Section>
      )}
      <EvidencePanel item={item} lang={lang} sources={entry.sources} />
    </div>
  )
}

function SentenceView({ item, lang, reports }: ItemViewProps) {
  const s = reviewStrings.use()
  const l = useLocalize()
  const sentence = sentenceById.get(item.id)
  const form = sentence?.[lang]
  if (!sentence || !form) return null
  return (
    <div className="space-y-5">
      <Header item={item} reported={reports.length > 0} />
      {reports.length > 0 && <ReportedBanner reports={reports} />}
      <div className="py-2">
        <TargetText lang={lang} text={form.text} latin={form.latin} size="xl" audio romanization="always" />
      </div>
      <Section title={s.meaning}>
        <Meaning value={sentence.translation} />
      </Section>
      <Section title={s.breakdown} hint={s.breakdownHint}>
        <TokenBreakdown lang={lang} tokens={form.tokens} />
      </Section>
      {form.colloquial && (
        <Section title={s.colloquial}>
          <Plain lang={lang} text={form.colloquial.text} latin={form.colloquial.latin} />
        </Section>
      )}
      {form.alternatives?.length ? (
        <Section title={s.alternatives}>
          <div className="space-y-1.5">
            {form.alternatives.map((a) => (
              <Plain key={a.text} lang={lang} text={a.text} latin={a.latin} />
            ))}
          </div>
        </Section>
      ) : null}
      {form.grammar?.length ? (
        <Section title={s.grammar}>
          <div className="flex flex-wrap gap-1.5">
            {form.grammar.map((g) => (
              <Badge key={g} variant="outline" className="font-normal">
                {grammarById.get(g) ? l(grammarById.get(g)!.title) : g}
              </Badge>
            ))}
          </div>
        </Section>
      ) : null}
      <EvidencePanel item={item} lang={lang} sources={form.sources} />
    </div>
  )
}

function QAView({ item, lang, reports }: ItemViewProps) {
  const s = reviewStrings.use()
  const qa = qaById.get(item.id)
  const form = qa?.[lang]
  if (!qa || !form) return null
  const slots = Object.entries(form.slots ?? {})
  return (
    <div className="space-y-5">
      <Header item={item} reported={reports.length > 0} />
      {reports.length > 0 && <ReportedBanner reports={reports} />}
      <Section title={s.question}>
        <div className="py-1">
          <TargetText lang={lang} text={form.question.text} latin={form.question.latin} size="xl" audio romanization="always" />
        </div>
        <Meaning value={qa.question} />
        {form.question.tokens && <TokenBreakdown lang={lang} tokens={form.question.tokens} />}
      </Section>
      <Section title={s.answers}>
        <ol className="space-y-2">
          {form.answers.map((a, i) => (
            <li key={a.text} className="space-y-2 rounded-xl border bg-background/60 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="pt-1 text-xs text-muted-foreground">{i === 0 ? s.canonical : `${i + 1}`}</span>
                <TargetText lang={lang} text={a.text} latin={a.latin} size="md" audio romanization="always" align="start" className="items-end" />
              </div>
              <p className="text-sm">
                <span lang="en">{a.translation.en}</span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span lang="sv" className="text-muted-foreground">
                  {a.translation.sv}
                </span>
              </p>
              {a.tokens && <TokenBreakdown lang={lang} tokens={a.tokens} />}
            </li>
          ))}
        </ol>
      </Section>
      {slots.length > 0 && (
        <Section title={s.slots} hint={s.slotsHint}>
          {slots.map(([name, values]) => (
            <div key={name} className="space-y-1.5">
              <code className="font-mono text-xs text-muted-foreground">{`{${name}}`}</code>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {values.map((v) => (
                  <Plain key={v.text} lang={lang} text={v.text} latin={v.latin} translation={v.translation} />
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}
      <EvidencePanel item={item} lang={lang} sources={form.sources} />
    </div>
  )
}