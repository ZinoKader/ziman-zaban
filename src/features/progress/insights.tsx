import { CalendarDays, CircleCheck, Clock, Flame, Hourglass, RotateCw, Trophy, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { ALL_MODULES, moduleBySkill } from '@/features/modules'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import type { DayStats } from '@/store/progress'
import { useSettings } from '@/store/settings'
import type { LogState } from './day-card'
import { dayMonth, dayTitle, shortDate, weekday } from './format'
import {
  accuracyOf,
  addDaysTo,
  busiest,
  bySkill,
  parseDay,
  punchCard,
  wordsOverTime,
  type Answer,
  type Records,
  type WordsPoint,
} from './stats-data'
import type { StatsViewPatch } from './stats-params'
import { statsStrings } from './stats-strings'

const SKILL_ORDER = ALL_MODULES.map((m) => m.skill)

function hm(ms: number) {
  const min = Math.round(ms / 60_000)
  return [Math.floor(min / 60), min % 60] as const
}

function Tile({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint: string; tone: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card px-4 py-3">
      <div className={cn('pointer-events-none absolute -end-6 -top-6 size-20 rounded-full opacity-15 blur-xl', tone)} />
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}

export function Highlights({
  streakNow,
  records,
  todayStats,
  due,
}: {
  streakNow: number
  records: Records
  todayStats: DayStats | undefined
  due: number
}) {
  const s = statsStrings.use()
  const [h, m] = hm(records.total.ms)
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        icon={<Flame className="size-4 text-orange-500" />}
        tone="bg-orange-500"
        label={s.highlights.streak}
        value={streakNow}
        hint={s.highlights.best(Math.max(streakNow, records.longestStreak?.days ?? 0))}
      />
      <Tile
        icon={<CircleCheck className="size-4 text-success" />}
        tone="bg-success"
        label={s.highlights.today}
        value={todayStats?.reviews ?? 0}
        hint={s.highlights.todayRight(todayStats ? accuracyOf(todayStats) : null)}
      />
      <Tile
        icon={<Hourglass className="size-4 text-mod-recall" />}
        tone="bg-mod-recall"
        label={s.highlights.due}
        value={due}
        hint={s.highlights.dueHint(due)}
      />
      <Tile
        icon={<Clock className="size-4 text-primary" />}
        tone="bg-primary"
        label={s.highlights.time}
        value={s.hours(h, m)}
        hint={s.highlights.timeHint(records.total.activeDays)}
      />
    </section>
  )
}

function LogPending({ log, rows = 3 }: { log: LogState; rows?: number }) {
  const s = statsStrings.use()
  if (log.failed)
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{s.logFailed}</span>
        <Button variant="outline" size="sm" onClick={log.retry}>
          <RotateCw /> {s.retry}
        </Button>
      </div>
    )
  return (
    <div className="space-y-2" aria-busy>
      <span className="sr-only">{s.logLoading}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}

export function ModulesCard({ answers, log, periodLabel }: { answers: Answer[] | undefined; log: LogState; periodLabel: string }) {
  const s = statsStrings.use()
  const c = common.use()
  const shares = useMemo(() => (answers ? bySkill(answers, SKILL_ORDER) : []), [answers])
  const total = shares.reduce((n, x) => n + x.reviews, 0)
  const max = Math.max(1, ...shares.map((x) => x.reviews))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{s.modules}</CardTitle>
        <CardDescription>
          {s.modulesHint} <span className="font-medium text-foreground/70">{periodLabel}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!answers ? (
          <LogPending log={log} />
        ) : !total ? (
          <p className="text-sm text-muted-foreground">{s.modulesEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {shares.map((x) => {
              const m = moduleBySkill.get(x.skill)!
              const Icon = m.icon
              const pct = accuracyOf(x)
              return (
                <li key={x.skill} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={cn('grid size-6 place-items-center rounded-md', m.soft, m.text)}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="flex-1 font-medium">{c.nav[x.skill]}</span>
                    <span className="tabular-nums text-muted-foreground">{s.answers(x.reviews)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', m.bg)} style={{ width: `${(x.reviews / max) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{s.share(Math.round((x.reviews / total) * 100))}</span>
                    {pct !== null && <span className={cn(pct >= 80 && 'text-success')}>{s.rightPct(pct)}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function WhenCard({ answers, log, periodLabel }: { answers: Answer[] | undefined; log: LogState; periodLabel: string }) {
  const s = statsStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const grid = useMemo(() => (answers ? punchCard(answers) : null), [answers])
  const peak = grid && busiest(grid)
  const max = peak?.count ?? 1
  const monday = parseDay('2024-01-01')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{s.when}</CardTitle>
        <CardDescription>
          {s.whenHint} <span className="font-medium text-foreground/70">{periodLabel}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!grid ? (
          <LogPending log={log} rows={4} />
        ) : !peak ? (
          <p className="text-sm text-muted-foreground">{s.whenEmpty}</p>
        ) : (
          <>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
              {grid.map((row, w) => (
                <div key={w} className="contents">
                  <span className="text-[0.65rem] text-muted-foreground">{weekday(addDaysTo(monday, w), lang, 'short')}</span>
                  <div className="grid grid-cols-24 gap-px">
                    {row.map((n, h) => (
                      <span key={h} className="grid aspect-square place-items-center" title={`${weekday(addDaysTo(monday, w), lang, 'long')} ${String(h).padStart(2, '0')}:00 · ${s.answers(n)}`}>
                        <span
                          className={cn('rounded-full', n ? 'bg-primary' : 'size-0.5 bg-muted-foreground/25')}
                          style={n ? { width: `${30 + 70 * Math.sqrt(n / max)}%`, height: `${30 + 70 * Math.sqrt(n / max)}%`, opacity: 0.35 + 0.65 * (n / max) } : undefined}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <span />
              <div aria-hidden className="grid grid-cols-4 text-[0.65rem] tabular-nums text-muted-foreground">
                <span>00</span>
                <span>06</span>
                <span>12</span>
                <span>18</span>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-sm">
              <Zap className="size-4 text-primary" />
              {s.whenPeak(weekday(addDaysTo(monday, peak.weekday), lang, 'long'), `${String(peak.hour).padStart(2, '0')}:00`)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

const wordsConfig = {
  met: { label: 'Met', color: 'var(--mod-recognition)' },
  learned: { label: 'Learned', color: 'var(--success)' },
} satisfies ChartConfig

function WordsTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: WordsPoint }> }) {
  const s = statsStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="space-y-1 rounded-xl border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="font-medium first-letter:uppercase">{dayTitle(p.date, lang)}</p>
      <p className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-mod-recognition" />
        <span className="flex-1 text-muted-foreground">{s.wordsMet}</span>
        <span className="font-medium tabular-nums">{p.met}</span>
      </p>
      <p className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-success" />
        <span className="flex-1 text-muted-foreground">{s.wordsLearned}</span>
        <span className="font-medium tabular-nums">{p.learned}</span>
      </p>
    </div>
  )
}

export function WordsCard({ answers, log, now }: { answers: Answer[] | undefined; log: LogState; now: Date }) {
  const s = statsStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const points = useMemo(() => (answers ? wordsOverTime(answers, now) : []), [answers, now])
  const last = points.at(-1)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{s.words}</CardTitle>
        <CardDescription>{s.wordsHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!answers ? (
          <LogPending log={log} rows={4} />
        ) : !last ? (
          <p className="text-sm text-muted-foreground">{s.wordsEmpty}</p>
        ) : (
          <>
            <div className="flex gap-6">
              <div>
                <div className="text-2xl font-semibold tabular-nums text-mod-recognition">{last.met}</div>
                <div className="text-xs text-muted-foreground">{s.wordsMet}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums text-success">{last.learned}</div>
                <div className="text-xs text-muted-foreground">{s.wordsLearned}</div>
              </div>
            </div>
            <ChartContainer config={wordsConfig} className="aspect-auto h-44 w-full">
              <AreaChart data={points} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="fill-met" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-met)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-met)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fill-learned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-learned)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-learned)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(d: string) => shortDate(parseDay(d), lang)}
                />
                <YAxis tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                <ChartTooltip cursor={{ stroke: 'var(--muted-foreground)', strokeOpacity: 0.3 }} content={<WordsTooltip />} />
                <Area dataKey="met" type="monotone" stroke="var(--color-met)" strokeWidth={2} fill="url(#fill-met)" />
                <Area dataKey="learned" type="monotone" stroke="var(--color-learned)" strokeWidth={2} fill="url(#fill-learned)" />
              </AreaChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RecordRow({
  icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail?: string
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate font-semibold tabular-nums">{value}</span>
      </span>
      {detail && <span className="shrink-0 text-end text-xs text-muted-foreground">{detail}</span>}
    </>
  )
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition hover:bg-muted/60">
          {body}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-2 py-2">{body}</div>
      )}
    </li>
  )
}

export function RecordsCard({ records, onChange }: { records: Records; onChange: (patch: StatsViewPatch) => void }) {
  const s = statsStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const { bestDay, bestWeek, longestStreak, firstDay, total } = records
  const [h, m] = hm(total.ms)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{s.records}</CardTitle>
      </CardHeader>
      <CardContent>
        {!bestDay || !bestWeek || !longestStreak || !firstDay ? (
          <p className="text-sm text-muted-foreground">{s.noRecords}</p>
        ) : (
          <ul className="-mx-2 divide-y">
            <RecordRow
              icon={<Trophy className="size-4" />}
              label={s.bestDay}
              value={s.answers(bestDay.reviews)}
              detail={dayMonth(parseDay(bestDay.day), lang)}
              onClick={() => onChange({ range: 'week', day: bestDay.day })}
            />
            <RecordRow
              icon={<CalendarDays className="size-4" />}
              label={s.bestWeek}
              value={s.answers(bestWeek.reviews)}
              detail={s.weekOf(dayMonth(parseDay(bestWeek.start), lang))}
              onClick={() => onChange({ range: 'week', day: bestWeek.start })}
            />
            <RecordRow
              icon={<Flame className="size-4" />}
              label={s.longestStreak}
              value={s.streakDays(longestStreak.days)}
              detail={`${dayMonth(parseDay(longestStreak.start), lang)}–${dayMonth(parseDay(longestStreak.end), lang)}`}
              onClick={() => onChange({ day: longestStreak.end })}
            />
            <RecordRow icon={<CircleCheck className="size-4" />} label={s.totalAnswers} value={String(total.reviews)} detail={s.allRight(accuracyOf(total))} />
            <RecordRow icon={<Clock className="size-4" />} label={s.totalTime} value={s.hours(h, m)} />
            <RecordRow
              icon={<CalendarDays className="size-4" />}
              label={s.since}
              value={dayMonth(parseDay(firstDay), lang) + ` ${firstDay.slice(0, 4)}`}
              onClick={() => onChange({ day: firstDay })}
            />
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
