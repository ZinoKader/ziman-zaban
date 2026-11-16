import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, type BarShapeProps, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { BaseLang } from '@/content/types'
import { cn } from '@/lib/utils'
import { dayKey, type DayStats } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { dayMonth, dayTitle, monthName, periodLabel, weekday } from './format'
import {
  accuracyOf,
  addDaysTo,
  bucketsOf,
  change,
  contains,
  METRICS,
  metricValue,
  RANGES,
  shiftPeriod,
  totalsBetween,
  type Bucket,
  type Metric,
  type Period,
  type Range,
  type Totals,
} from './stats-data'
import type { StatsViewPatch } from './stats-params'
import { statsStrings } from './stats-strings'

const config = {
  correct: { label: 'Right', color: 'var(--success)' },
  wrong: { label: 'Wrong', color: 'var(--destructive)' },
  minutes: { label: 'Minutes', color: 'var(--primary)' },
  newItems: { label: 'New', color: 'var(--mod-recall)' },
  accuracy: { label: 'Accuracy', color: 'var(--mod-response)' },
} satisfies ChartConfig

function formatMetric(metric: Metric, v: number | null): string {
  if (v === null) return '–'
  return metric === 'accuracy' ? `${v}%` : String(v)
}

function Delta({ pct, good = true }: { pct: number | null; good?: boolean }) {
  const s = statsStrings.use()
  if (pct === null) return <span className="text-xs text-muted-foreground" title={s.nothingBefore}>–</span>
  if (pct === 0) return <span className="text-xs text-muted-foreground">{s.noChange}</span>
  const up = pct > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
        up === good ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
      )}
    >
      <Icon className="size-3" />
      {up ? '+' : ''}
      {pct}%
    </span>
  )
}

function MetricTile({
  metric,
  active,
  now,
  before,
  onSelect,
}: {
  metric: Metric
  active: boolean
  now: Totals
  before: Totals
  onSelect: () => void
}) {
  const s = statsStrings.use()
  const value = metricValue(now, metric)
  const prev = metricValue(before, metric)
  const delta = metric === 'accuracy' ? (value !== null && prev !== null ? value - prev : null) : change(value, prev)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      title={s.metricHint[metric]}
      className={cn(
        'flex min-w-0 flex-col items-start gap-1 rounded-2xl border bg-card px-3 py-2.5 text-start transition hover:bg-muted/60',
        active && 'border-primary/40 bg-primary/5 ring-2 ring-primary/20 hover:bg-primary/5',
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{s.metric[metric]}</span>
      <span className="text-2xl font-semibold tabular-nums">{formatMetric(metric, value)}</span>
      <Delta pct={delta} />
    </button>
  )
}

interface Point extends Bucket {
  label: string
  minutes: number
  accuracy: number | null
}

function tick(b: Bucket, range: Range, lang: BaseLang): string {
  if (range === 'year') return monthName(b.start, lang)
  if (range === 'week') return weekday(b.start, lang, 'short')
  return String(b.start.getDate())
}

function PointTooltip({ active, payload, range }: { active?: boolean; payload?: Array<{ payload: Point }>; range: Range }) {
  const s = statsStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const title = range === 'year' ? monthName(p.start, lang, 'long') + ` ${p.start.getFullYear()}` : dayTitle(p.start, lang)
  const rows: Array<[string, string, string]> = [
    [s.correct, String(p.correct), 'bg-success'],
    [s.wrong, String(p.wrong), 'bg-destructive'],
    [s.metric.minutes, String(p.minutes), 'bg-primary'],
    [s.metric.new, String(p.newItems), 'bg-mod-recall'],
  ]
  return (
    <div className="min-w-40 space-y-1.5 rounded-xl border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{title}</p>
      {p.reviews === 0 ? (
        <p className="text-muted-foreground">{s.emptyDay}</p>
      ) : (
        <>
          <p className="text-muted-foreground">
            {s.answers(p.reviews)}
            {p.accuracy !== null && ` · ${p.accuracy}%`}
          </p>
          <ul className="space-y-0.5">
            {rows.map(([label, value, dot]) => (
              <li key={label} className="flex items-center gap-2">
                <span className={cn('size-2 rounded-full', dot)} />
                <span className="flex-1 text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">{value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function ActivityCard({
  days,
  period,
  metric,
  day,
  today,
  onChange,
}: {
  days: Record<string, DayStats>
  period: Period
  metric: Metric
  day: string
  today: Date
  onChange: (patch: StatsViewPatch) => void
}) {
  const s = statsStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const { range } = period
  const before = shiftPeriod(period, -1)
  const after = shiftPeriod(period, 1)
  const isCurrent = contains(period, today)
  const canGoNext = after.start <= today

  const now = useMemo(() => totalsBetween(days, period.start, period.end), [days, period.start, period.end])
  const elapsedDays = Math.round((addDaysTo(today, 1).getTime() - period.start.getTime()) / 86_400_000)
  const prevEnd = isCurrent ? Math.min(addDaysTo(before.start, elapsedDays).getTime(), before.end.getTime()) : before.end.getTime()
  const prev = useMemo(() => totalsBetween(days, before.start, new Date(prevEnd)), [days, before.start, prevEnd])
  const points: Point[] = useMemo(
    () =>
      bucketsOf(period, days).map((b) => ({
        ...b,
        label: tick(b, range, lang),
        minutes: Math.round(b.ms / 60_000),
        accuracy: accuracyOf(b),
      })),
    [period, days, range, lang],
  )
  const elapsed = points.filter((p) => p.start <= today).length
  const avg = (() => {
    if (metric === 'accuracy') return accuracyOf(now)
    const active = points.filter((p) => p.reviews > 0)
    if (!active.length) return null
    const total = active.reduce((n, p) => n + (metric === 'answers' ? p.reviews : metric === 'minutes' ? p.minutes : p.newItems), 0)
    return Math.round(total / active.length)
  })()
  const selectedKey = range === 'year' ? day.slice(0, 7) : day
  const open = (p: Point) => {
    if (p.start > today) return
    if (range === 'year') onChange({ range: 'month', at: dayKey(p.start) })
    else onChange({ day: p.key })
  }
  const dim = (p: Point) => (points.some((x) => x.key === selectedKey) && p.key !== selectedKey ? 0.55 : 1)

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">{s.activity}</CardTitle>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={range}
            onValueChange={(v) => v && onChange({ range: v as Range })}
            aria-label={s.range.label}
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r} value={r} className="px-3">
                {s.range[r]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={s.previous} onClick={() => onChange({ at: dayKey(before.start) })}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <p className="min-w-0 flex-1 text-center font-medium tabular-nums sm:flex-none sm:px-2" aria-live="polite">
            {periodLabel(range, period.start, period.end, lang)}
          </p>
          <Button variant="ghost" size="icon" aria-label={s.next} disabled={!canGoNext} onClick={() => onChange({ at: dayKey(after.start) })}>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
          {!isCurrent && (
            <Button variant="outline" size="sm" className="ms-auto" onClick={() => onChange({ at: dayKey(today) })}>
              {s.thisPeriod[range]}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div role="radiogroup" aria-label={s.activity} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METRICS.map((m) => (
              <MetricTile key={m} metric={m} active={m === metric} now={now} before={prev} onSelect={() => onChange({ metric: m })} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{(isCurrent ? s.vsSoFar : s.vsBefore)[range]}</p>
        </div>

        <ChartContainer config={config} className="aspect-auto h-56 w-full sm:h-64">
          <ComposedChart
            data={points}
            className="cursor-pointer"
            onClick={(state) => {
              const i = Number(state?.activeTooltipIndex)
              if (Number.isInteger(i) && points[i]) open(points[i])
            }}
            margin={{ top: 8, right: 4, left: -4, bottom: 0 }} barCategoryGap={range === 'month' ? '18%' : '28%'}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              padding={metric === 'accuracy' ? { left: 12, right: 12 } : undefined} interval={range === 'month' ? 'preserveStartEnd' : 0} minTickGap={6} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={metric === 'accuracy' ? 46 : 40}
              allowDecimals={false}
              domain={metric === 'accuracy' ? [0, 100] : [0, 'auto']}
              tickFormatter={(v: number) => (metric === 'accuracy' ? `${v}%` : String(v))}
            />
            <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<PointTooltip range={range} />} />
            {avg !== null && avg > 0 && (
              <ReferenceLine
                y={avg}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{ value: `${s.average} ${formatMetric(metric, avg)}`, position: 'insideTopRight', fontSize: 11, fill: 'var(--muted-foreground)' }}
              />
            )}
            {metric === 'answers' && (
              <>
                <Bar
                  dataKey="correct"
                  stackId="a"
                  fill="var(--color-correct)"
                  shape={(props: BarShapeProps) => <TopRounded {...props} round={!(props.payload as Point).wrong} opacity={dim(props.payload as Point)} />}
                />
                <Bar
                  dataKey="wrong"
                  stackId="a"
                  fill="var(--color-wrong)"
                  shape={(props: BarShapeProps) => <TopRounded {...props} round opacity={dim(props.payload as Point) * 0.7} />}
                />
              </>
            )}
            {(metric === 'minutes' || metric === 'new') && (
              <Bar
                dataKey={metric === 'minutes' ? 'minutes' : 'newItems'}
                fill={metric === 'minutes' ? 'var(--color-minutes)' : 'var(--color-newItems)'}
                radius={[6, 6, 0, 0]}
              >
                {points.map((p) => (
                  <Cell key={p.key} fillOpacity={dim(p)} />
                ))}
              </Bar>
            )}
            {metric === 'accuracy' && (
              <Line
                dataKey="accuracy"
                type="monotone"
                stroke="var(--color-accuracy)"
                strokeWidth={2.5}
                connectNulls
                dot={{ r: 3.5, fill: 'var(--color-accuracy)', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            )}
          </ComposedChart>
        </ChartContainer>

        <ol className="sr-only" aria-label={periodLabel(range, period.start, period.end, lang)}>
          {points.map((p) => (
            <li key={p.key}>
              {range === 'year' ? monthName(p.start, lang, 'long') : dayMonth(p.start, lang)}: {s.answers(p.reviews)}
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {now.reviews ? (
            <span>
              {s.activeDays(now.activeDays, range === 'year' ? daysIn(period, today) : elapsed)}
              {' · '}
              {s.perActiveDay(Math.round(now.reviews / Math.max(1, now.activeDays)))}
            </span>
          ) : (
            <span>{s.emptyPeriod}</span>
          )}
          <span className="text-xs">{range === 'year' ? s.chartHint.month : s.chartHint.day}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function TopRounded({ x = 0, y = 0, width = 0, height = 0, fill, round, opacity }: BarShapeProps & { round: boolean; opacity: number }) {
  if (height <= 0 || width <= 0) return null
  const r = round ? Math.min(6, width / 2, height) : 0
  const d = `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
  return <path d={d} fill={fill} fillOpacity={opacity} />
}

function daysIn(p: Period, today: Date): number {
  const end = p.end > today ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) : p.end
  return Math.max(0, Math.round((end.getTime() - p.start.getTime()) / 86_400_000))
}

