import { PartyPopper, RotateCcw, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Skill } from '@/content/types'
import { common } from '@/i18n/common'

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

export function SessionSummary({ skill, stats, empty, onRestart, onExit }: SessionSummaryProps) {
  const s = common.use()
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
    { label: s.session.reviewed, value: stats.reviewed },
    { label: s.session.newLearned, value: stats.newItems },
    { label: s.session.accuracy, value: `${accuracy}%` },
    { label: s.session.time, value: formatDuration(stats.ms) },
  ]
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-12 text-center animate-pop-in">
      <div className="rounded-full bg-primary/10 p-5 text-primary">
        <PartyPopper className="size-12" />
      </div>
      <div>
        <h2 className="text-3xl font-semibold">{s.session.finished}</h2>
        <p className="mt-1 text-muted-foreground">{s.modules[skill].title}</p>
      </div>
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
        <Button size="xl" variant="outline" className="flex-1" onClick={onRestart}>
          <RotateCcw /> {s.session.again}
        </Button>
        <Button size="xl" className="flex-1" onClick={onExit}>
          {s.session.home}
        </Button>
      </div>
    </div>
  )
}
