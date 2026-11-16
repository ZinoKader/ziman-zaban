import { Check, ChevronDown, ChevronLeft, ChevronRight, RotateCw, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { moduleBySkill } from '@/features/modules'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { dayKey, type DayStats } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { dayMonth, dayTitle, timeOf } from './format'
import { accuracyOf, addDaysTo, answersBetween, itemLabel, parseDay, sessionsOf, type Answer, type Session } from './stats-data'
import { statsStrings } from './stats-strings'

type Filter = 'all' | 'wrong' | 'new'

export interface LogState {
  answers: Answer[] | undefined
  failed: boolean
  retry: () => void
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl bg-muted/50 px-3 py-2.5">
      <div className={cn('text-xl font-medium', tone)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function HourStrip({ answers }: { answers: Answer[] }) {
  const s = statsStrings.use()
  const hours = useMemo(() => {
    const out = Array.from({ length: 24 }, () => ({ correct: 0, wrong: 0 }))
    for (const a of answers) out[a.at.getHours()][a.correct ? 'correct' : 'wrong']++
    return out
  }, [answers])
  const max = Math.max(1, ...hours.map((h) => h.correct + h.wrong))
  return (
    <figure className="space-y-1.5">
      <figcaption className="text-xs font-medium text-muted-foreground">{s.byHour}</figcaption>
      <ol className="flex h-14 items-end gap-px sm:gap-0.5" aria-label={s.byHour}>
        {hours.map((h, i) => {
          const n = h.correct + h.wrong
          return (
            <li key={i} className="flex h-full flex-1 flex-col justify-end" title={`${String(i).padStart(2, '0')}:00 · ${s.answers(n)}`}>
              <span className="sr-only">
                {String(i).padStart(2, '0')}:00: {s.answers(n)}
              </span>
              {n ? (
                <div className="flex flex-col overflow-hidden rounded-t-sm" style={{ height: `${Math.max(12, (n / max) * 100)}%` }}>
                  <div className="bg-destructive/70" style={{ flexGrow: h.wrong }} />
                  <div className="bg-success" style={{ flexGrow: h.correct }} />
                </div>
              ) : (
                <div className="h-0.5 rounded-full bg-muted" />
              )}
            </li>
          )
        })}
      </ol>
      <div aria-hidden className="flex justify-between text-[0.65rem] tabular-nums text-muted-foreground">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </figure>
  )
}

function SkillDot({ skill }: { skill: Answer['skill'] }) {
  const c = common.use()
  const m = moduleBySkill.get(skill)
  if (!m) return null
  const Icon = m.icon
  return (
    <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', m.soft, m.text)} title={c.nav[skill]}>
      <Icon className="size-4" />
      <span className="sr-only">{c.nav[skill]}</span>
    </span>
  )
}

function AnswerRow({ a, showLang }: { a: Answer; showLang: boolean }) {
  const s = statsStrings.use()
  const c = common.use()
  const l = useLocalize()
  const lang = useSettings((st) => st.baseLang)
  const label = itemLabel(a.skill, a.itemId, a.lang)
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <time dateTime={a.at.toISOString()} className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
        {timeOf(a.at, lang, true)}
      </time>
      <SkillDot skill={a.skill} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-medium">{label.target?.latin ?? a.itemId}</span>
          {label.target && (
            <span lang={a.lang} dir="rtl" className="hidden truncate font-script text-muted-foreground sm:inline">
              {label.target.script}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {showLang && <span className="font-medium text-foreground/70">{c.languagesShort[a.lang]} · </span>}
          {label.meaning && l(label.meaning)}
        </span>
      </span>
      {a.isNew && (
        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-mod-recall/10 px-2 py-0.5 text-xs font-medium text-mod-recall sm:inline-flex">
          <Sparkles className="size-3" />
          {s.firstTime}
        </span>
      )}
      <span className="hidden w-10 shrink-0 text-end text-xs tabular-nums text-muted-foreground sm:block">{s.seconds(Math.round(a.ms / 1000))}</span>
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full',
          a.correct ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
        )}
        title={a.correct ? s.rightMark : s.wrongMark}
      >
        {a.correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
        <span className="sr-only">{a.correct ? s.rightMark : s.wrongMark}</span>
      </span>
    </li>
  )
}

function SessionBlock({ session, filter, showLang }: { session: Session; filter: Filter; showLang: boolean }) {
  const s = statsStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const shown = session.answers.filter((a) => (filter === 'wrong' ? !a.correct : filter === 'new' ? a.isNew : true))
  const pct = accuracyOf({ reviews: session.answers.length, correct: session.correct })
  const ms = session.answers.reduce((n, a) => n + a.ms, 0)
  return (
    <Collapsible defaultOpen={filter !== 'all'} className="overflow-hidden rounded-2xl border">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 bg-muted/30 px-3 py-2.5 text-start transition hover:bg-muted/60">
        <span className="min-w-0 flex-1">
          <span className="block font-medium tabular-nums">
            {timeOf(session.start, lang)}–{timeOf(session.end, lang)}
          </span>
          <span className="block text-xs text-muted-foreground">{s.sessionLine(session.answers.length, pct, Math.round(ms / 60_000))}</span>
        </span>
        <span className="flex -space-x-1.5 rtl:space-x-reverse">
          {session.skills.map((k) => (
            <SkillDot key={k} skill={k} />
          ))}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {shown.length ? (
          <ol className="divide-y">
            {shown.map((a, i) => (
              <AnswerRow key={`${a.key}-${a.at.getTime()}-${i}`} a={a} showLang={showLang} />
            ))}
          </ol>
        ) : (
          <p className="px-3 py-3 text-sm text-muted-foreground">{s.noneMatch}</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

function neighbour(days: Record<string, DayStats>, day: string, dir: -1 | 1): string | null {
  const active = Object.keys(days).filter((k) => days[k].reviews > 0)
  const candidates = active.filter((k) => (dir < 0 ? k < day : k > day)).sort()
  return (dir < 0 ? candidates.at(-1) : candidates[0]) ?? null
}

export function DayCard({
  days,
  day,
  today,
  log,
  showLang,
  onDay,
}: {
  days: Record<string, DayStats>
  day: string
  today: Date
  log: LogState
  showLang: boolean
  onDay: (day: string) => void
}) {
  const s = statsStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const [filter, setFilter] = useState<Filter>('all')
  const date = parseDay(day)
  const todayKey = dayKey(today)
  const stats = days[day]
  const answers = useMemo(() => {
    const start = parseDay(day)
    return log.answers && answersBetween(log.answers, start, addDaysTo(start, 1))
  }, [log.answers, day])
  const sessions = useMemo(() => (answers ? sessionsOf(answers) : []), [answers])
  const reviews = stats?.reviews ?? answers?.length ?? 0
  const pct = stats ? accuracyOf(stats) : null
  const before = neighbour(days, day, -1)
  const after = neighbour(days, day, 1)

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">{s.day}</CardTitle>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              aria-label={s.dayPick}
              className="h-8 w-auto"
              value={day}
              max={todayKey}
              onChange={(e) => e.target.value && e.target.value <= todayKey && onDay(e.target.value)}
            />
            {day !== todayKey && (
              <Button variant="outline" size="sm" onClick={() => onDay(todayKey)}>
                {s.today}
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={s.previousDay} onClick={() => onDay(dayKey(addDaysTo(date, -1)))}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <h3 className="min-w-0 flex-1 text-center text-base font-semibold first-letter:uppercase sm:flex-none sm:px-2" aria-live="polite">
            {dayTitle(date, lang)}
          </h3>
          <Button variant="ghost" size="icon" aria-label={s.nextDay} disabled={day >= todayKey} onClick={() => onDay(dayKey(addDaysTo(date, 1)))}>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {reviews === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed p-5 text-center">
            <p className="text-sm text-muted-foreground">{s.emptyDay}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {before && (
                <Button variant="outline" size="sm" onClick={() => onDay(before)}>
                  <ChevronLeft className="rtl:rotate-180" />
                  {s.lastActive}: {dayMonth(parseDay(before), lang)}
                </Button>
              )}
              {after && (
                <Button variant="outline" size="sm" onClick={() => onDay(after)}>
                  {s.nextActive}: {dayMonth(parseDay(after), lang)}
                  <ChevronRight className="rtl:rotate-180" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <Kpi label={s.metric.answers} value={reviews} />
              <Kpi label={s.metric.accuracy} value={pct === null ? '–' : `${pct}%`} tone={pct !== null && pct >= 80 ? 'text-success' : undefined} />
              <Kpi label={s.metric.minutes} value={Math.round((stats?.ms ?? 0) / 60_000)} />
              <Kpi label={s.metric.new} value={stats?.newItems ?? 0} />
              <Kpi label={s.sessionsLabel} value={answers ? sessions.length : '…'} />
            </div>

            {log.failed ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <span>{s.logFailed}</span>
                <Button variant="outline" size="sm" onClick={log.retry}>
                  <RotateCw /> {s.retry}
                </Button>
              </div>
            ) : !answers ? (
              <div className="space-y-2" aria-busy>
                <span className="sr-only">{s.logLoading}</span>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <>
                <HourStrip answers={answers} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">{s.sessions(sessions.length)}</h4>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={filter}
                    onValueChange={(v) => v && setFilter(v as Filter)}
                    aria-label={s.filter.label}
                  >
                    {(['all', 'wrong', 'new'] as const).map((f) => (
                      <ToggleGroupItem key={f} value={f} className="px-3">
                        {s.filter[f]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div className="space-y-2">
                  {sessions.map((x) => (
                    <SessionBlock key={`${day}-${x.start.getTime()}-${filter}`} session={x} filter={filter} showLang={showLang} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
