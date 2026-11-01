import {
  ArrowRight,
  ArrowRightLeft,
  BadgeCheck,
  BookOpen,
  BrainCircuit,
  CalendarClock,
  CheckCheck,
  CircleHelp,
  ExternalLink,
  Flag,
  Heart,
  Languages,
  Layers,
  MessageCircleQuestion,
  MessagesSquare,
  MonitorSmartphone,
  ShieldCheck,
  ShieldQuestion,
  Shuffle,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { EvidenceBadge } from '@/components/evidence-badge'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { conceptById, type EvidenceLevel } from '@/content'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { MODULES, moduleWhy } from '@/features/modules'
import { useSettings } from '@/store/settings'
import { CITATIONS, PRINCIPLES, type Citation, type PrincipleId } from './citations'
import { countEvidence, EVIDENCE_KINDS, EVIDENCE_LEVELS, exampleIdAt, type LevelCounts } from './evidence-stats'
import { aboutStrings } from './strings'

const PRINCIPLE_ICONS: Record<PrincipleId, LucideIcon> = {
  retrieval: BrainCircuit,
  spacing: CalendarClock,
  feedback: CheckCheck,
  direction: ArrowRightLeft,
  questions: MessageCircleQuestion,
  dialogue: MessagesSquare,
  scaffolding: Layers,
  webapp: MonitorSmartphone,
  interleaving: Shuffle,
  romanization: Languages,
}

/** Same icons and colours as the evidence badge on word cards. */
const LEVEL_STYLE: Record<EvidenceLevel, { icon: LucideIcon; text: string; bar: string }> = {
  'native-reviewed': { icon: BadgeCheck, text: 'text-success', bar: 'bg-success' },
  strong: { icon: ShieldCheck, text: 'text-success', bar: 'bg-success/65' },
  good: { icon: ShieldCheck, text: 'text-primary', bar: 'bg-primary/70' },
  attested: { icon: ShieldQuestion, text: 'text-muted-foreground', bar: 'bg-muted-foreground/35' },
  none: { icon: CircleHelp, text: 'text-warning', bar: 'bg-warning' },
}

const SOURCES = [
  { key: 'wiktionary', license: 'CC BY-SA 4.0', url: 'https://www.wiktionary.org' },
  { key: 'tatoeba', license: 'CC BY 2.0 FR', url: 'https://tatoeba.org' },
  { key: 'thackston', license: null, url: null },
  { key: 'kim', license: null, url: null },
  { key: 'vazirmatn', license: 'SIL OFL 1.1', url: 'https://github.com/rastikerdar/vazirmatn' },
  { key: 'fsrs', license: 'MIT', url: 'https://github.com/open-spaced-repetition/ts-fsrs' },
  { key: 'parsvoice', license: 'CPML (non-commercial)', url: 'https://huggingface.co/MohammadJRanjbar/ParsVoice-XTTS' },
  { key: 'audio8Fa', license: 'CC BY-NC 4.0', url: 'https://huggingface.co/ArminRahimi/Audio8-TTS-Persian' },
  { key: 'audio8', license: 'CC BY-NC 4.0', url: 'https://huggingface.co/ArminRahimi/Audio8-TTS-Kurdish-Sorani' },
  { key: 'vekol', license: 'CC BY-NC 4.0', url: 'https://huggingface.co/RevgeAI/vekol-tts-ckb-edge' },
] as const

function Section({ id, title, body, children, className }: { id: string; title: string; body?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('scroll-mt-20 space-y-5', className)}>
      <div className="max-w-2xl space-y-1.5">
        <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {body && <p className="text-muted-foreground sm:text-lg">{body}</p>}
      </div>
      {children}
    </section>
  )
}

function Hero() {
  const s = aboutStrings.use()
  const nav = Object.entries(s.nav) as Array<[keyof typeof s.nav, string]>
  return (
    <header className="relative overflow-hidden rounded-[2rem] border bg-linear-to-br from-primary/10 via-card to-mod-response/10 px-5 py-8 sm:px-10 sm:py-12">
      <div
        aria-hidden
        dir="rtl"
        className="pointer-events-none absolute -top-3 -right-2 flex flex-col items-start font-script text-6xl leading-[1.3] text-primary/10 select-none sm:-top-6 sm:-right-4 sm:flex-row sm:gap-6 sm:text-9xl"
      >
        <span lang="ckb">زمان</span>
        <span lang="fa">زبان</span>
      </div>
      <div className="relative max-w-2xl space-y-4">
        <p className="text-sm font-medium text-primary">{s.eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{s.title}</h1>
        <p className="text-base leading-relaxed sm:text-lg">{s.lead}</p>
        <p className="text-sm text-muted-foreground italic">{s.nameNote}</p>
        <nav aria-label={s.title} className="flex flex-wrap gap-2 pt-2">
          {nav.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-full border bg-background/70 px-3 py-1 text-sm font-medium backdrop-blur transition hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

function Path() {
  const s = aboutStrings.use()
  const c = common.use()
  const why = moduleWhy.use()
  return (
    <Section id="path" title={s.pathTitle} body={s.pathBody}>
      <ol className="relative grid gap-4 lg:grid-cols-4">
        {MODULES.map((m, i) => (
          <li key={m.skill} className="relative flex gap-4 lg:flex-col">
            {i < MODULES.length - 1 && (
              <>
                <span aria-hidden className="absolute start-[1.375rem] top-14 bottom-[-1rem] w-0.5 bg-border lg:hidden" />
                <ArrowRight
                  aria-hidden
                  className="absolute top-3.5 -end-3.5 z-10 hidden size-5 rounded-full bg-background text-muted-foreground lg:block rtl:rotate-180"
                />
              </>
            )}
            <span className={cn('relative z-10 grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm', m.bg)}>
              <m.icon className="size-6" />
            </span>
            <div className={cn('flex-1 space-y-2 rounded-3xl border bg-card p-4 shadow-xs ring-1 lg:min-h-full', m.ring)}>
              <p className={cn('text-xs font-semibold tracking-wide uppercase', m.text)}>
                {s.step(m.step)} · {s.stepVerb[m.skill]}
              </p>
              <h3 className="text-lg font-semibold">{c.modules[m.skill].title}</h3>
              <p className="text-sm font-medium">{c.modules[m.skill].description}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{why[m.skill]}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function CitationLine({ cite }: { cite: Citation }) {
  return (
    <li className="text-xs leading-relaxed text-muted-foreground">
      <span className="text-foreground">{cite.authors}</span> ({cite.year}). <span className="italic">{cite.title}.</span> {cite.venue}.
      {cite.doi && (
        <>
          {' '}
          <a
            href={`https://doi.org/${cite.doi}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
          >
            doi:{cite.doi}
            <ExternalLink className="size-3" />
          </a>
        </>
      )}
    </li>
  )
}

function Science() {
  const s = aboutStrings.use()
  return (
    <Section id="science" title={s.scienceTitle} body={s.scienceBody}>
      <div className="grid gap-4 md:grid-cols-2">
        {PRINCIPLES.map((p) => {
          const text = s.principles[p.id]
          const Icon = PRINCIPLE_ICONS[p.id]
          const caveat = 'caveat' in text ? text.caveat : undefined
          return (
            <article key={p.id} className="flex flex-col gap-3 rounded-3xl border bg-card p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="space-y-1">
                  <h3 className="font-semibold">{text.title}</h3>
                  <p className="text-[0.95rem] leading-snug font-medium">{text.claim}</p>
                </div>
              </div>
              <p className="rounded-2xl bg-muted/60 px-3 py-2 text-sm">
                <span className="font-medium">{s.inApp}: </span>
                {text.inApp}
              </p>
              <div className="mt-auto space-y-2 border-t pt-3">
                <p className="text-sm leading-relaxed">
                  <span className="font-medium">{s.evidence}: </span>
                  {text.finding}
                </p>
                {caveat && (
                  <p className="flex gap-1.5 text-xs text-muted-foreground">
                    <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
                    {caveat}
                  </p>
                )}
                <ul className="space-y-1">
                  {p.cites.map((id) => (
                    <CitationLine key={id} cite={CITATIONS[id]} />
                  ))}
                </ul>
              </div>
            </article>
          )
        })}
      </div>
    </Section>
  )
}

function LevelBar({ counts, label }: { counts: LevelCounts; label: string }) {
  if (!counts.total) return null
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{counts.total}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${EVIDENCE_LEVELS.map((l) => `${l} ${counts[l]}`).join(', ')}`}>
        {EVIDENCE_LEVELS.map((l) =>
          counts[l] ? <span key={l} className={LEVEL_STYLE[l].bar} style={{ width: `${(counts[l] / counts.total) * 100}%` }} /> : null,
        )}
      </div>
    </div>
  )
}

function Accuracy() {
  const s = aboutStrings.use()
  const c = common.use()
  const lang = useSettings((st) => st.targetLang)
  const counts = useMemo(() => countEvidence(), [])
  const demoId = exampleIdAt('strong', lang) ?? exampleIdAt('good', lang)
  const demo = demoId ? conceptById.get(demoId) : undefined
  const langs: TargetLang[] = ['ckb', 'fa']

  return (
    <Section id="accuracy" title={s.accuracyTitle} body={s.accuracyBody}>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {s.pipeline.map((step, i) => (
          <li key={step.title} className="relative rounded-3xl border bg-card p-4 shadow-xs">
            <span className="mb-2 grid size-8 place-items-center rounded-full bg-foreground text-sm font-semibold text-background">{i + 1}</span>
            <h3 className="font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="overflow-hidden rounded-3xl border bg-card shadow-xs">
          <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
            <h3 className="font-semibold">{s.levels.title}</h3>
            <p className="text-xs text-muted-foreground">{s.levels.live}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th scope="col">{s.levels.title}</th>
                {langs.map((l) => (
                  <th key={l} scope="col">{c.languagesShort[l]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {EVIDENCE_LEVELS.map((level) => {
                const { icon: Icon, text } = LEVEL_STYLE[level]
                return (
                  <tr key={level}>
                    <th scope="row" className="px-4 py-3 text-start align-top font-normal">
                      <span className={cn('flex items-center gap-1.5 font-medium', text)}>
                        <Icon className="size-4 shrink-0" /> {c.evidence[level]}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{s.levels.meaning[level]}</span>
                    </th>
                    {langs.map((l) => (
                      <td key={l} className="w-16 px-2 py-3 text-end align-top tabular-nums sm:w-20">
                        <span className="block text-base font-semibold">{counts.concept[l][level]}</span>
                        <span className="block text-[0.7rem] text-muted-foreground">{c.languagesShort[l]}</span>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">{s.levels.sentences}</p>
        </div>

        <div className="flex flex-col gap-4">
          {langs.map((l) => (
            <div key={l} className="space-y-3 rounded-3xl border bg-card p-4 shadow-xs">
              <h3 className="flex items-center gap-2 font-semibold">
                <span lang={l} className="font-script text-lg font-normal text-primary">{l === 'ckb' ? 'کوردی' : 'فارسی'}</span>
                {c.languages[l]}
              </h3>
              {EVIDENCE_KINDS.map((kind) => (
                <LevelBar
                  key={kind}
                  counts={counts[kind][l]}
                  label={kind === 'concept' ? s.levels.words : kind === 'sentence' ? s.levels.sentencesLabel : s.levels.qa}
                />
              ))}
            </div>
          ))}
          {demo?.[lang] && demoId && (
            <div className="flex items-center gap-3 rounded-3xl border border-dashed p-4">
              <div className="shrink-0 text-center">
                <span dir="rtl" lang={lang} className="block font-script text-2xl">{demo[lang]!.primary.script}</span>
                <EvidenceBadge kind="concept" lang={lang} id={demoId} showLabel />
              </div>
              <p className="text-sm text-muted-foreground">{s.levels.badgeHint}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl bg-foreground p-5 text-background sm:flex-row sm:items-center sm:p-6">
        <div className="flex-1 space-y-1">
          <h3 className="text-lg font-semibold">{s.reviewTitle}</h3>
          <p className="text-sm opacity-80">{s.reviewBody}</p>
          <p className="flex items-center gap-1.5 pt-1 text-xs opacity-70">
            <Flag className="size-3.5" /> {s.reportNote}
          </p>
        </div>
        <Button asChild size="xl" variant="secondary">
          <Link to="/review">
            <ShieldCheck /> {s.reviewCta}
          </Link>
        </Button>
      </div>
    </Section>
  )
}

function Sources() {
  const s = aboutStrings.use()
  return (
    <Section id="sources" title={s.sourcesTitle}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SOURCES.map((src) => {
          const text = s.sources[src.key]
          return (
            <li key={src.key} className="flex flex-col gap-2 rounded-3xl border bg-card p-4 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug">
                  {src.url ? (
                    <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                      {text.name} <ExternalLink className="size-3.5 text-muted-foreground" />
                    </a>
                  ) : (
                    text.name
                  )}
                </h3>
                {!src.url && <BookOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              </div>
              <p className="text-sm text-muted-foreground">{text.what}</p>
              <p className="mt-auto pt-1">
                <span className="rounded-full border px-2 py-0.5 font-mono text-[0.7rem]">
                  {src.license ? `${s.license}: ${src.license}` : s.referenceUse}
                </span>
              </p>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function Dialects() {
  const s = aboutStrings.use()
  return (
    <Section id="dialects" title={s.dialectTitle}>
      <div className="grid gap-4 md:grid-cols-3">
        {(['ckb', 'fa'] as TargetLang[]).map((l) => (
          <div key={l} className="space-y-1.5 rounded-3xl border bg-card p-5 shadow-xs">
            <span lang={l} className="font-script text-2xl text-primary">{l === 'ckb' ? 'سلێمانی' : 'تهران'}</span>
            <h3 className="font-semibold">{s.dialects[l].title}</h3>
            <p className="text-sm text-muted-foreground">{s.dialects[l].body}</p>
          </div>
        ))}
        <div className="space-y-3 rounded-3xl border bg-card p-5 shadow-xs">
          <h3 className="font-semibold">{s.writtenSpoken}</h3>
          <p className="text-sm text-muted-foreground">{s.writtenSpokenBody}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: s.written, text: 'می‌خواهم', latin: 'mikhâham' },
              { label: s.spoken, text: 'می‌خوام', latin: 'mikhâm' },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-muted/60 px-2 py-2 text-center">
                <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">{f.label}</p>
                <TargetText lang="fa" text={f.text} latin={f.latin} size="sm" romanization="always" />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">“{s.iWant}”</p>
        </div>
      </div>
    </Section>
  )
}

function Limits() {
  const s = aboutStrings.use()
  const counts = useMemo(() => countEvidence(), [])
  const unverified = EVIDENCE_KINDS.reduce((sum, k) => sum + counts[k].ckb.none + counts[k].fa.none, 0)
  return (
    <Section id="limits" title={s.limitsTitle}>
      <ul className="space-y-2.5">
        {s.limits.map((item) => (
          <li key={item} className="flex gap-3 rounded-2xl border bg-card px-4 py-3 text-sm leading-relaxed">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      {unverified > 0 && <p className="text-sm text-muted-foreground">{s.unverified(unverified)}</p>}
      <p className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
        <Heart className="size-4 text-mod-construction" aria-hidden /> {s.thanks}
      </p>
    </Section>
  )
}

export function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-6 sm:space-y-20 sm:py-10">
      <Hero />
      <Path />
      <Science />
      <Accuracy />
      <Sources />
      <Dialects />
      <Limits />
    </div>
  )
}
