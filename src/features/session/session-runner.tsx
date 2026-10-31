import { X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { Skill, TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import type { Candidate } from '@/lib/curriculum'
import { Rating } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { useProgress } from '@/store/progress'
import { SessionSummary, type SessionStats } from './session-summary'
import type { ExerciseProps, ExerciseResult } from './types'
import { ScriptToggle } from '@/components/script-toggle'

/** A missed item comes back after this many other items (spaced within the session). */
const RELEARN_GAP = 4
/** ...but at most this many extra times per session, to avoid frustration loops. */
const MAX_RETRIES = 2

const MODULE_COLOR: Record<Skill, string> = {
  recognition: '[&_[data-slot=progress-indicator]]:bg-mod-recognition',
  recall: '[&_[data-slot=progress-indicator]]:bg-mod-recall',
  construction: '[&_[data-slot=progress-indicator]]:bg-mod-construction',
  response: '[&_[data-slot=progress-indicator]]:bg-mod-response',
}

interface Turn {
  item: Candidate
  attempt: number
}

interface SessionRunnerProps {
  skill: Skill
  lang: TargetLang
  queue: Candidate[]
  Exercise: React.ComponentType<ExerciseProps>
  onExit: () => void
  onRestart: () => void
}

export function SessionRunner({ skill, lang, queue, Exercise, onExit, onRestart }: SessionRunnerProps) {
  const s = common.use()
  const record = useProgress((st) => st.record)
  const [turns, setTurns] = useState<Turn[]>(() => queue.map((item) => ({ item, attempt: 0 })))
  const [index, setIndex] = useState(0)
  const startedAt = useRef(Date.now())
  const firstTry = useRef(new Map<string, boolean>())
  const [finished, setFinished] = useState(queue.length === 0)

  const uniqueTotal = queue.length
  const completed = useMemo(() => {
    const done = new Set<string>()
    for (let i = 0; i < index; i++) {
      const t = turns[i]
      const isLastShowing = !turns.slice(i + 1).some((u) => u.item.key === t.item.key)
      if (isLastShowing) done.add(t.item.key)
    }
    return done.size
  }, [index, turns])

  const handleDone = (result: ExerciseResult) => {
    const turn = turns[index]
    record(turn.item.key, result.grade, { ms: result.ms, kind: result.kind })
    if (!firstTry.current.has(turn.item.key)) firstTry.current.set(turn.item.key, result.grade > Rating.Again)

    let next = turns
    if (result.grade === Rating.Again && turn.attempt < MAX_RETRIES) {
      next = [...turns]
      next.splice(Math.min(index + 1 + RELEARN_GAP, next.length), 0, { item: turn.item, attempt: turn.attempt + 1 })
      setTurns(next)
    }
    if (index + 1 >= next.length) setFinished(true)
    else setIndex(index + 1)
  }

  if (finished) {
    const results = [...firstTry.current.values()]
    const stats: SessionStats = {
      reviewed: uniqueTotal,
      correctFirstTry: results.filter(Boolean).length,
      newItems: queue.filter((q) => q.isNew).length,
      ms: Date.now() - startedAt.current,
    }
    return <SessionSummary skill={skill} stats={stats} empty={queue.length === 0} onRestart={onRestart} onExit={onExit} />
  }

  const turn = turns[index]
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-3 sm:pt-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={s.session.quit}>
          <X />
        </Button>
        <Progress value={(completed / Math.max(uniqueTotal, 1)) * 100} className={cn('h-3 flex-1', MODULE_COLOR[skill])} />
        <span className="text-end text-sm tabular-nums text-muted-foreground">
          {s.session.progress(completed, uniqueTotal)}
        </span>
        <ScriptToggle />
      </div>
      <Exercise key={`${turn.item.key}#${index}`} item={turn.item} lang={lang} attempt={turn.attempt} onDone={handleDone} />
    </div>
  )
}
