import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, Languages } from 'lucide-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { TargetText } from '@/components/target-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { grammarById, grammarPoints, sentencesFor, unitById, units } from '@/content'
import type { GrammarPoint, TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { counterpartOf, formatCitation, groupByUnit, readingOrder, sentencesWithGrammar } from './grammar-data'
import { GrammarExampleView } from './interlinear'
import { Markup, ScriptRuns } from './markup'
import { teaser } from './markup-parse'
import { grammarStrings } from './strings'

function GrammarList({ lang }: { lang: TargetLang }) {
  const s = grammarStrings.use()
  const l = useLocalize()
  const groups = useMemo(() => groupByUnit(grammarPoints, lang, units), [lang])

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 sm:pt-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{s.title}</h1>
        <p className="mt-2 max-w-prose leading-relaxed text-muted-foreground">{s.intro(s.langName[lang])}</p>
      </header>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-16 text-center">
          <GraduationCap className="size-9 text-muted-foreground" aria-hidden />
          <p className="max-w-sm text-muted-foreground">{s.empty(s.langName[lang])}</p>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map(({ unit, unitId, points }) => (
            <section key={unitId} aria-labelledby={`grammar-unit-${unitId}`}>
              <h2 id={`grammar-unit-${unitId}`} className="mb-3 flex items-baseline gap-2.5">
                {unit && (
                  <span aria-hidden className="text-xl">
                    {unit.emoji}
                  </span>
                )}
                <span className="text-lg font-semibold">{unit ? l(unit.title) : unitId}</span>
                <span className="text-sm text-muted-foreground">{s.count(points.length)}</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {points.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/grammar/${p.id}`}
                      className="group flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-semibold leading-snug group-hover:text-primary">{l(p.title)}</span>
                        <Badge variant="outline" className="shrink-0 font-normal">
                          {p.level}
                        </Badge>
                      </span>
                      <span className="text-sm leading-relaxed text-muted-foreground">
                        <ScriptRuns text={teaser(l(p.explanation))} lang={p.lang} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function SideNav({ point, order }: { point: GrammarPoint; order: GrammarPoint[] }) {
  const s = grammarStrings.use()
  const l = useLocalize()
  const groups = groupByUnit(order, point.lang, units)
  return (
    <nav aria-label={s.contents} className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto pe-2 lg:block">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.contents}</p>
      <div className="space-y-5">
        {groups.map(({ unit, unitId, points }) => (
          <div key={unitId}>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
              {unit && <span aria-hidden>{unit.emoji}</span>}
              {unit ? l(unit.title) : unitId}
            </p>
            <ul className="space-y-0.5 border-s">
              {points.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/grammar/${p.id}`}
                    aria-current={p.id === point.id ? 'page' : undefined}
                    className={cn(
                      '-ms-px block border-s-2 border-transparent py-1 ps-3 text-sm leading-snug text-muted-foreground transition hover:text-foreground',
                      p.id === point.id && 'border-primary font-medium text-foreground',
                    )}
                  >
                    {l(p.title)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

function SectionHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold tracking-tight">{children}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

function GrammarDetail({ point }: { point: GrammarPoint }) {
  const s = grammarStrings.use()
  const l = useLocalize()
  const navigate = useNavigate()
  const compare = useSettings((st) => st.compare)
  const lang = point.lang
  const unit = unitById.get(point.unit)
  const order = useMemo(() => readingOrder(grammarPoints, lang, units), [lang])
  const index = order.findIndex((p) => p.id === point.id)
  const prev = index > 0 ? order[index - 1] : undefined
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : undefined
  const counterpart = compare ? counterpartOf(point, grammarPoints) : undefined
  const courseSentences = useMemo(() => sentencesWithGrammar(sentencesFor(lang), lang, point.id), [lang, point.id])

  useEffect(() => {
    document.documentElement.scrollTop = 0
  }, [point.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'ArrowLeft' && prev) navigate(`/grammar/${prev.id}`)
      if (e.key === 'ArrowRight' && next) navigate(`/grammar/${next.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, navigate])

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:pt-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
      <SideNav point={point} order={order} />

      <article className="mx-auto w-full max-w-2xl">
        <Link
          to="/grammar"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> {s.allGrammar}
        </Link>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {unit && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden>{unit.emoji}</span>
                {l(unit.title)}
              </span>
            )}
            <Badge variant="outline" className="font-normal">
              {point.level}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {s.langBadge[lang]}
            </Badge>
          </div>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{l(point.title)}</h1>
        </header>

        <Markup source={l(point.explanation)} lang={lang} className="text-[1.05rem] leading-[1.85] text-foreground/90" />

        {counterpart && (
          <Link
            to={`/grammar/${counterpart.id}`}
            className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed bg-muted/40 px-4 py-3 transition hover:border-primary/50 hover:bg-accent"
          >
            <Languages className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{s.howOther[counterpart.lang]}</span>
              <span className="truncate text-sm text-muted-foreground">{l(counterpart.title)}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}

        {point.examples.length > 0 && (
          <section className="mt-12" aria-labelledby="grammar-examples">
            <SectionHeading>
              <span id="grammar-examples">{s.examples}</span>
            </SectionHeading>
            <div className="space-y-4">
              {point.examples.map((ex, i) => (
                <GrammarExampleView key={i} {...ex} lang={lang} />
              ))}
            </div>
          </section>
        )}

        {courseSentences.length > 0 && (
          <section className="mt-12" aria-labelledby="grammar-course">
            <SectionHeading hint={s.inTheCourseHint}>
              <span id="grammar-course">{s.inTheCourse}</span>
            </SectionHeading>
            <ul className="divide-y rounded-2xl border bg-card">
              {courseSentences.map((sentence) => {
                const form = sentence[lang]!
                return (
                  <li key={sentence.id} className="space-y-1 px-4 py-3.5">
                    <TargetText lang={lang} text={form.text} latin={form.latin} size="sm" align="start" audio />
                    <p className="text-sm text-muted-foreground">{l(sentence.translation)}</p>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {point.sources.length > 0 && (
          <section className="mt-12" aria-labelledby="grammar-sources">
            <h2 id="grammar-sources" className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="size-3.5" aria-hidden /> {s.sources}
            </h2>
            <ul className="space-y-1 text-sm leading-relaxed">
              {point.sources.map((src, i) => (
                <li key={i} className="ps-4 -indent-4">
                  {formatCitation(src, s)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{s.sourcesNote}</p>
          </section>
        )}

        <nav aria-label={s.pager} className="mt-12 grid grid-cols-2 gap-3 border-t pt-6">
          {prev ? (
            <Button asChild variant="ghost" className="h-auto flex-col items-start gap-0.5 rounded-2xl px-4 py-3 text-start whitespace-normal">
              <Link to={`/grammar/${prev.id}`} rel="prev" aria-keyshortcuts="ArrowLeft">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowLeft className="size-3.5" aria-hidden /> {s.previous}
                </span>
                <span className="font-medium leading-snug">{l(prev.title)}</span>
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button asChild variant="ghost" className="h-auto flex-col items-end gap-0.5 rounded-2xl px-4 py-3 text-end whitespace-normal">
              <Link to={`/grammar/${next.id}`} rel="next" aria-keyshortcuts="ArrowRight">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {s.next} <ArrowRight className="size-3.5" aria-hidden />
                </span>
                <span className="font-medium leading-snug">{l(next.title)}</span>
              </Link>
            </Button>
          )}
        </nav>
      </article>
    </div>
  )
}

export function GrammarPage() {
  const s = grammarStrings.use()
  const { pointId } = useParams()
  const lang = useSettings((st) => st.targetLang)

  if (!pointId) return <GrammarList lang={lang} />
  const point = grammarById.get(pointId)
  if (!point) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <GraduationCap className="size-9 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">{s.notFound}</p>
        <Button asChild variant="outline">
          <Link to="/grammar">{s.allGrammar}</Link>
        </Button>
      </div>
    )
  }
  return <GrammarDetail point={point} />
}
