import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import type { LogState } from './day-card'
import { weekday } from './format'
import { LogPending } from './insights'
import type { Memory } from './progress-data'
import { statsStrings } from './stats-strings'
import { progressStrings } from './strings'

const BANDS = [
  ['sticking', 'bg-success'],
  ['fading', 'bg-amber-500'],
  ['slipping', 'bg-destructive'],
] as const

function Bands({ memory }: { memory: Memory }) {
  const s = statsStrings.use()
  return (
    <figure className="space-y-3">
      <figcaption className="sr-only">{s.bandsLabel}</figcaption>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {BANDS.map(([band, tone]) =>
          memory[band] ? <div key={band} className={tone} style={{ flexGrow: memory[band] }} /> : null,
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {BANDS.map(([band, tone]) => (
          <div key={band} className="min-w-0">
            <dt className="flex items-start gap-1.5 text-xs leading-tight text-muted-foreground">
              <span className={cn('mt-0.5 size-2.5 shrink-0 rounded-full', tone)} />
              <span>{s.band[band]}</span>
            </dt>
            <dd className="text-lg font-semibold tabular-nums">{memory[band]}</dd>
            <dd className="text-xs text-muted-foreground">{s.bandHint[band]}</dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}

function Rate({ label, pct, detail }: { label: string; pct: number | null; detail: string }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="min-h-[2lh] text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{pct === null ? '–' : `${pct}%`}</div>
      <div className="relative h-1.5 rounded-full bg-muted" aria-hidden>
        {pct !== null && <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />}
        <div className="absolute -top-1 bottom-[-0.25rem] w-0.5 rounded-full bg-foreground/60" style={{ insetInlineStart: '90%' }} />
      </div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

function Holds({ holds }: { holds: Memory['holds'] }) {
  const s = statsStrings.use()
  const max = Math.max(1, ...holds)
  return (
    <figure className="space-y-2">
      <figcaption>
        <span className="block text-sm font-medium">{s.holds}</span>
        <span className="block text-xs text-muted-foreground">{s.holdsHint}</span>
      </figcaption>
      <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm">
        {holds.map((n, i) => (
          <div key={i} className="contents">
            <dt className="text-muted-foreground">{s.holdLabels[i]}</dt>
            <div className="h-2.5" aria-hidden>
              <div className="h-full rounded-e-sm bg-primary" style={{ width: n ? `${Math.max(2, (n / max) * 100)}%` : 0 }} />
            </div>
            <dd className="text-end tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}

export function MemoryCard({
  memory,
  recall,
  log,
}: {
  memory: Memory
  recall: { reviews: number; correct: number } | undefined
  log: LogState
}) {
  const s = statsStrings.use()
  const rate = recall?.reviews ? Math.round((recall.correct / recall.reviews) * 100) : null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{s.memory}</CardTitle>
        <CardDescription>{s.memoryHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {memory.learned === 0 ? (
          <p className="text-sm text-muted-foreground">{s.memoryEmpty}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-3xl font-semibold tabular-nums">{memory.sticking}</span>
              <span className="text-muted-foreground">{s.sticking(memory.learned)}</span>
            </p>
            <Bands memory={memory} />
            <div className="grid grid-cols-2 gap-4">
              <Rate label={s.recallNow} pct={memory.recall} detail={s.reviewTarget} />
              {recall ? (
                <Rate
                  label={s.reviewRate}
                  pct={rate}
                  detail={recall.reviews ? s.reviewCount(recall.reviews) : s.noReviews}
                />
              ) : (
                <LogPending log={log} rows={2} />
              )}
            </div>
            <Holds holds={memory.holds} />
          </>
        )}
        {memory.learning > 0 && <p className="text-xs text-muted-foreground">{s.stillLearning(memory.learning)}</p>}
      </CardContent>
    </Card>
  )
}

export function ForecastCard({ days }: { days: Array<{ day: string; date: Date; count: number }> }) {
  const s = progressStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const total = days.reduce((n, d) => n + d.count, 0)
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{s.forecast}</CardTitle>
        <CardDescription>{s.forecastHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">{s.forecastNone}</p>
        ) : (
          <>
            <p className="text-sm font-medium">{s.forecastTotal(total)}</p>
            <ol aria-label={s.forecast} className="flex h-40 items-end gap-1.5">
              {days.map((d, i) => {
                const name = i === 0 ? s.today : weekday(d.date, lang, 'short')
                return (
                  <li key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs tabular-nums text-muted-foreground" aria-hidden>
                      {d.count || ''}
                    </span>
                    <div
                      aria-hidden
                      className={cn('w-full rounded-t-md', d.count ? (i === 0 ? 'bg-primary' : 'bg-primary/45') : 'bg-muted')}
                      style={{ height: d.count ? `${Math.max(4, (d.count / max) * 100)}%` : '2px' }}
                    />
                    <span className="sr-only">{s.forecastBar(name, d.count)}</span>
                    <span aria-hidden className={cn('w-full truncate text-center text-[0.7rem] text-muted-foreground', i === 0 && 'font-semibold text-foreground')}>
                      {name}
                    </span>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </CardContent>
    </Card>
  )
}
