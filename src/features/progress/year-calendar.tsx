import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dayKey, type DayStats } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { dayMonth, monthName, weekday } from './format'
import { addDaysTo, heatmapOf, parseDay, type HeatCell } from './stats-data'
import { statsStrings } from './stats-strings'

const LEVEL = ['bg-muted', 'bg-primary/25', 'bg-primary/45', 'bg-primary/70', 'bg-primary'] as const
const STEP: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }

export function YearCalendar({
  days,
  today,
  selected,
  onDay,
}: {
  days: Record<string, DayStats>
  today: Date
  selected: string
  onDay: (day: string) => void
}) {
  const s = statsStrings.use()
  const lang = useSettings((st) => st.baseLang)
  const weeks = useMemo(() => heatmapOf(days, today), [days, today])
  const [hover, setHover] = useState<HeatCell | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const focusNext = useRef(false)
  const cells = weeks.flat()
  const first = cells[0].day
  const todayKey = dayKey(today)
  const total = cells.reduce((n, c) => n + c.reviews, 0)
  const inRange = selected >= first && selected <= todayKey
  const tabStop = inRange ? selected : todayKey
  const shown = hover ?? cells.find((c) => c.day === selected)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  useEffect(() => {
    if (!focusNext.current) return
    focusNext.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${selected}"]`)?.focus()
  }, [selected])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = STEP[e.key]
    if (!step) return
    e.preventDefault()
    const next = dayKey(addDaysTo(parseDay(tabStop), step))
    if (next < first || next > todayKey) return
    focusNext.current = true
    onDay(next)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{s.calendar}</CardTitle>
        <CardDescription>
          {s.calendarTotal(total)} · {s.calendarHint}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={scroller} className="-mx-2 overflow-x-auto px-2 pb-1">
          <div className="inline-grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <span />
            <div aria-hidden className="grid auto-cols-[0.8rem] grid-flow-col gap-[3px] text-[0.65rem] text-muted-foreground">
              {weeks.map((w, i) => {
                const firstOfMonth = w.find((c) => c.date.getDate() === 1)
                const label = firstOfMonth && i < weeks.length - 2 ? monthName(firstOfMonth.date, lang) : ''
                return (
                  <span key={w[0].day} className="overflow-visible whitespace-nowrap">
                    {label}
                  </span>
                )
              })}
            </div>
            <div aria-hidden className="grid grid-rows-7 gap-[3px] text-[0.65rem] leading-[0.8rem] text-muted-foreground">
              {weeks[0].map((c, i) => (
                <span key={c.day}>{i % 2 === 0 ? weekday(c.date, lang, 'short') : ''}</span>
              ))}
            </div>
            <div
              ref={grid}
              role="group"
              aria-label={s.calendar}
              onKeyDown={onKeyDown}
              onMouseLeave={() => setHover(null)}
              className="grid auto-cols-[0.8rem] grid-flow-col grid-rows-7 gap-[3px]"
            >
              {cells.map((c) => {
                const label = s.cell(dayMonth(c.date, lang), c.reviews)
                if (c.future) return <span key={c.day} aria-hidden className="size-[0.8rem]" />
                return (
                  <button
                    key={c.day}
                    type="button"
                    data-day={c.day}
                    tabIndex={c.day === tabStop ? 0 : -1}
                    aria-label={label}
                    aria-current={c.day === selected || undefined}
                    title={label}
                    onClick={() => onDay(c.day)}
                    onMouseEnter={() => setHover(c)}
                    onFocus={() => setHover(c)}
                    onBlur={() => setHover(null)}
                    className={cn(
                      'size-[0.8rem] rounded-[3px] outline-none transition hover:ring-2 hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring',
                      LEVEL[c.level],
                      c.day === selected && 'ring-2 ring-foreground ring-offset-1 ring-offset-card',
                      c.day === todayKey && c.day !== selected && 'ring-1 ring-foreground/40',
                    )}
                  />
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span aria-live="polite" className="min-h-4 font-medium text-foreground/80">
            {shown && s.cell(dayMonth(shown.date, lang), shown.reviews)}
          </span>
          <span className="flex items-center gap-1" aria-hidden>
            {s.less}
            {LEVEL.map((l) => (
              <span key={l} className={cn('size-[0.7rem] rounded-[3px]', l)} />
            ))}
            {s.more}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
