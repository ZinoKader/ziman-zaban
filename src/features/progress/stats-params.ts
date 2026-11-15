import { useSearchParams } from 'react-router'
import { dayKey } from '@/store/progress'
import { isDayKey, METRICS, parseDay, periodOf, RANGES, type Metric, type Period, type Range } from './stats-data'

export interface StatsView {
  range: Range
  metric: Metric
  /** The day shown in "Day by day". */
  day: string
  period: Period
}

export interface StatsViewPatch {
  range?: Range
  metric?: Metric
  /** Selecting a day also moves the period to the one that holds it. */
  day?: string
  /** Shows the period holding this day without changing the selected day. */
  at?: string
}

/** The statistics view, kept in the address so a view can be shared, bookmarked and gone back to. */
export function useStatsView(now: Date): [StatsView, (patch: StatsViewPatch) => void] {
  const [params, setParams] = useSearchParams()
  const today = dayKey(now)
  const rangeParam = params.get('range') as Range | null
  const metricParam = params.get('metric') as Metric | null
  const range = rangeParam && RANGES.includes(rangeParam) ? rangeParam : 'week'
  const metric = metricParam && METRICS.includes(metricParam) ? metricParam : 'answers'
  const dayParam = params.get('day')
  const day = isDayKey(dayParam) && dayParam <= today ? dayParam : today
  const atParam = params.get('at')
  const period = periodOf(range, parseDay(isDayKey(atParam) ? atParam : day))

  const update = (patch: StatsViewPatch) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        const put = (key: string, value: string | undefined, fallback: string) =>
          value === undefined ? undefined : value === fallback ? next.delete(key) : next.set(key, value)
        put('range', patch.range, 'week')
        put('metric', patch.metric, 'answers')
        if (patch.day !== undefined) {
          put('day', patch.day, today)
          next.delete('at')
        }
        if (patch.at !== undefined) next.set('at', patch.at)
        return next
      },
      { replace: true },
    )

  return [{ range, metric, day, period }, update]
}
