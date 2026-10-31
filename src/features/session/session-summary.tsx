import { CircleCheck, LoaderCircle, PartyPopper, RotateCcw, Sprout, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Skill } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { Meter } from '@/features/progress/meter'
import { sessionGain } from '@/features/progress/progress-data'
import { progressStrings } from '@/features/progress/strings'
import { cardsBefore, lastRecordedAt, useProgress } from '@/store/progress'
import { useSaveStatus } from '@/store/save-status'
import { useSettings } from '@/store/settings'

export interface SessionStats {
  reviewed: number
  correctFirstTry: number
  newItems: number
  ms: number
}

interface SessionSummaryProps {
  skill: Skill
  stats: SessionStats
  empty: boolean
  onRestart: () => void
  onExit: () => void
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

function useSaved(): 'saving' | 'saved' | 'failed' {
  const { lastSavedAt, failed, medium } = useSaveStatus()
  if (failed || medium === 'memory') return 'failed'
  const last = lastRecordedAt()
  if (last === null || (lastSavedAt && Date.parse(lastSavedAt) >= last)) return 'saved'
  return 'saving'
}

function SavedBadge() {
  const p = progressStrings.use()
  const state = useSaved()
  const Icon = state === 'saved' ? CircleCheck : state === 'saving' ? LoaderCircle : TriangleAlert
  return (
    <p
      role="status"
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
        state === 'saved' && 'bg-success/12 text-success',
        state === 'saving' && 'bg-muted text-muted-foreground',
        state === 'failed' && 'bg-destructive/10 text-destructive',
      )}
    >
      <Icon className={cn('size-4', state === 'saving' && 'motion-safe:animate-spin')} />
      {state === 'saved' ? p.progressSaved : state === 'saving' ? p.saving : p.saveFailed}
    </p>
  )
}

export function SessionSummary({ skill, stats, empty, onRestart, onExit }: SessionSummaryProps) {
  const s = common.use()
  const p = progressStrings.use()
  const lang = useSettings((st) => st.targetLang)
  const cards = useProgress((st) => st.cards)
  const [since] = useState(() => Date.now() - stats.ms)
  const gain = useMemo(() => sessionGain(skill, lang, cardsBefore(since, cards), cards), [skill, lang, since, cards])

  if (empty) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <Sprout className="size-12 text-primary" />
        <h2 className="text-2xl font-semibold">{s.session.empty}</h2>
        <p className="text-muted-foreground">{s.session.emptyHint}</p>
        <Button size="xl" onClick={onExit}>
          {s.session.home}
        </Button>
      </div>
    )
  }
  const accuracy = stats.reviewed ? Math.round((stats.correctFirstTry / stats.reviewed) * 100) : 0
  const tiles = [
    { label: s.session.accuracy, value: `${accuracy}%` },
    { label: s.session.reviewed, value: stats.reviewed },
    { label: s.session.newLearned, value: stats.newItems },
    { label: s.session.time, value: formatDuration(stats.ms) },
  ]
  const { course, module } = gain
  const learnedNow = gain.newlyLearned.length
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-10 text-center animate-pop-in sm:py-12">
      <div className="rounded-full bg-primary/10 p-5 text-primary">
        <PartyPopper className="size-12" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <div>
          <h2 className="text-3xl font-semibold">{s.session.finished}</h2>
          <p className="mt-1 text-muted-foreground">{s.modules[skill].title}</p>
        </div>
        <SavedBadge />
      </div>

      <Card className="w-full py-5 text-start">
        <CardContent className="space-y-5 px-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{p.wordsLearned}</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {p.counts(course.after.learned, course.after.learning, course.after.total)}
              </span>
            </div>
            <Meter
              learned={course.after.learned}
              learning={course.after.learning}
              total={course.after.total}
              from={{ learned: course.before.learned, learning: course.before.learning }}
              size="md"
              label={p.know(course.after.learned, course.after.total)}
            />
            {learnedNow > 0 ? (
              <div className="space-y-1.5 pt-1">
                <p className="text-sm font-medium text-success">{p.newlyLearned(learnedNow)}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {gain.newlyLearned.slice(0, 12).map((c) => (
                    <li key={c.id} className="rounded-full bg-muted px-2.5 py-0.5 text-sm">
                      {c.emoji && <span aria-hidden className="me-1">{c.emoji}</span>}
                      {c[lang]?.primary.latin}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              course.after.learning > 0 && <p className="text-xs text-muted-foreground">{p.learnedLater}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{s.modules[skill].title}</span>
              <span className="tabular-nums text-muted-foreground">
                {p.counts(module.after.learned, module.after.started - module.after.learned, module.after.total)}
              </span>
            </div>
            <Meter
              learned={module.after.learned}
              learning={module.after.started - module.after.learned}
              total={module.after.total}
              from={{ learned: module.before.learned, learning: module.before.started - module.before.learned }}
              tone={skill}
              size="xs"
              label={p.moduleLabel(s.modules[skill].title, module.after.learned, module.after.total)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="py-4">
            <CardContent className="px-3">
              <div className="text-2xl font-semibold tabular-nums">{t.value}</div>
              <div className="text-xs text-muted-foreground">{t.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button size="xl" variant="outline" className="sm:flex-1" onClick={onRestart}>
          <RotateCcw /> {s.session.again}
        </Button>
        <Button size="xl" className="sm:flex-1" onClick={onExit}>
          {s.session.home}
        </Button>
      </div>
    </div>
  )
}
