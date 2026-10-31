import { PartyPopper, SearchX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { useProgress } from '@/store/progress'
import { DecisionPanel } from './decision-panel'
import { ExportPanel } from './export-panel'
import { ReviewItemView } from './item-view'
import {
  buildQueue,
  DEFAULT_FILTERS,
  matchesScope,
  nextKey,
  orderWithReports,
  primaryText,
  reportsByKey,
  type QueueFilters as Filters,
  type QueueItem,
} from './queue'
import { QueueFilters } from './queue-filters'
import { ReviewStats } from './review-stats'
import { SetupForm } from './setup-form'
import { ShortcutLegend } from './shortcut-legend'
import { useReview } from './store'
import { reviewStrings } from './strings'

/** Cursor value meaning "past the last item". */
const END = '__end__'

export function ReviewPage() {
  const reviewer = useReview((st) => st.reviewer)
  const lang = useReview((st) => st.lang)
  const [editing, setEditing] = useState(false)
  if (!reviewer || !lang || editing) return <SetupForm onDone={() => setEditing(false)} />
  return <ReviewWorkspace key={lang} lang={lang} reviewer={reviewer} onEditSetup={() => setEditing(true)} />
}

function ReviewWorkspace({ lang, reviewer, onEditSetup }: { lang: TargetLang; reviewer: string; onEditSetup: () => void }) {
  const s = reviewStrings.use()
  const c = common.use()
  const decisions = useReview((st) => st.decisions)
  const filters = useReview((st) => st.filters)
  const cursorKey = useReview((st) => st.cursor[lang])
  const { approve, flag, undo, setFilters, setCursor } = useReview.getState()
  const reports = useProgress((st) => st.reports)
  const [history, setHistory] = useState<string[]>([])

  const queue = useMemo(() => buildQueue(lang), [lang])
  const reported = useMemo(() => reportsByKey(reports, lang), [reports, lang])
  const ordered = useMemo(() => orderWithReports(queue, new Set(reported.keys())), [queue, reported])
  const scope = useMemo(() => ordered.filter((q) => matchesScope(q, filters)), [ordered, filters])
  const include = (q: QueueItem) => matchesScope(q, filters) && (!filters.unreviewedOnly || !decisions[q.key])
  const visible = scope.filter((q) => !filters.unreviewedOnly || !decisions[q.key])

  const atEnd = cursorKey === END
  // The cursor item stays visible even when "unreviewed only" would hide it, so Back can show past decisions.
  const current = atEnd ? undefined : (scope.find((q) => q.key === cursorKey) ?? visible[0])
  const position = current ? scope.indexOf(current) : -1
  const reviewedInScope = scope.filter((q) => decisions[q.key]).length

  const currentKey = current?.key
  useEffect(() => {
    if (currentKey) window.scrollTo({ top: 0 })
  }, [currentKey])

  const goTo = (key: string | null) => setCursor(lang, key ?? END)
  const advance = () => {
    if (!current) return
    setHistory((h) => [...h, current.key])
    goTo(nextKey(ordered, current.key, include))
  }
  const canBack = history.length > 0 || (atEnd ? scope.length > 0 : position > 0)
  const back = () => {
    const prev = history.at(-1)
    if (prev) {
      setHistory((h) => h.slice(0, -1))
      return goTo(prev)
    }
    const pos = atEnd ? scope.length : position
    if (pos > 0) goTo(scope[pos - 1].key)
  }
  const changeFilters = (patch: Partial<Filters>) => {
    setFilters(patch)
    setHistory([])
    setCursor(lang, null)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">{s.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>{c.languages[lang]}</span>
          <span aria-hidden>·</span>
          <span>{s.reviewingAs(reviewer)}</span>
          <Button variant="link" size="xs" className="h-auto px-0" onClick={onEditSetup}>
            {s.change}
          </Button>
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium" aria-live="polite">
                {s.progress(reviewedInScope, scope.length)}
              </span>
              {current && <span className="tabular-nums text-muted-foreground">{s.position(position + 1, scope.length)}</span>}
            </div>
            <Progress value={scope.length ? (reviewedInScope / scope.length) * 100 : 0} aria-label={s.progress(reviewedInScope, scope.length)} />
          </div>

          <QueueFilters filters={filters} onChange={changeFilters} />

          {current ? (
            <>
              <article key={current.key} className="rounded-3xl border bg-card p-4 shadow-sm animate-pop-in sm:p-6" aria-label={s.kind[current.kind]}>
                <ReviewItemView item={current} lang={lang} reports={reported.get(current.key) ?? []} />
              </article>
              <DecisionPanel
                key={`${current.key}:decision`}
                lang={lang}
                currentText={primaryText(current, lang)}
                decision={decisions[current.key]}
                canBack={canBack}
                onCorrect={() => {
                  approve(current.key)
                  advance()
                }}
                onIncorrect={(detail) => {
                  flag(current.key, detail)
                  advance()
                }}
                onSkip={advance}
                onBack={back}
                onUndo={() => undo(current.key)}
              />
            </>
          ) : (
            <EmptyState
              kind={atEnd ? 'end' : scope.length ? 'done' : 'filtered'}
              onRestart={() => {
                setHistory([])
                goTo(visible[0]?.key ?? scope[0]?.key ?? null)
              }}
              onBack={canBack ? back : undefined}
              onResetFilters={() => changeFilters(DEFAULT_FILTERS)}
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>{s.statsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ReviewStats queue={queue} decisions={decisions} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{s.exportTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ExportPanel lang={lang} />
            </CardContent>
          </Card>
          <Card className="hidden md:flex">
            <CardHeader>
              <CardTitle>{s.shortcuts}</CardTitle>
            </CardHeader>
            <CardContent>
              <ShortcutLegend />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function EmptyState({
  kind,
  onRestart,
  onBack,
  onResetFilters,
}: {
  kind: 'end' | 'done' | 'filtered'
  onRestart: () => void
  onBack?: () => void
  onResetFilters: () => void
}) {
  const s = reviewStrings.use()
  const Icon = kind === 'filtered' ? SearchX : PartyPopper
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card/50 px-6 py-12 text-center animate-pop-in">
      <Icon className="size-10 text-primary" aria-hidden />
      <p className="text-lg font-semibold">{kind === 'end' ? s.endTitle : kind === 'done' ? s.allDone : s.emptyFilter}</p>
      {kind !== 'filtered' && <p className="max-w-sm text-sm text-muted-foreground">{s.endBody}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            {s.back}
          </Button>
        )}
        {kind === 'end' && <Button onClick={onRestart}>{s.startOver}</Button>}
        {kind !== 'end' && <Button variant="outline" onClick={onResetFilters}>{s.resetFilters}</Button>}
      </div>
    </div>
  )
}
