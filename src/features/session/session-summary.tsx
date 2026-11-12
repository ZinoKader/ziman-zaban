import { ArrowRight, CircleCheck, LoaderCircle, Medal, PartyPopper, RotateCcw, Sparkles, Sprout, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Skill } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { Celebration } from '@/features/medals/celebration'
import { medalsToAward, nextMilestone } from '@/features/medals/medals'
import { medalStrings } from '@/features/medals/strings'
import { MODULES } from '@/features/modules'
import { Meter } from '@/features/progress/meter'
import { sessionGain } from '@/features/progress/progress-data'
import { progressStrings } from '@/features/progress/strings'
import { useServerSaves } from '@/data/server-saves'
import { cardsBefore, getProgress, useAwardMedals, useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { nextSteps } from './next-steps'
import { sessionStrings } from './strings'
import type { SessionKind } from './use-session'

export interface SessionStats {
  reviewed: number
  correctFirstTry: number
  newItems: number
  ms: number
  /** `Date.now()` when the session started; reviews from then on count as this session's. */
  startedAt: number
}

interface SessionSummaryProps {
  skill: Skill
  stats: SessionStats
  empty: boolean
  /** The units this session was limited to, if any; suggestions stay within them. */
  units?: string[]
  onRestart: (kind: SessionKind) => void
  onExit: () => void
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

function useSaved(): 'saving' | 'saved' | 'failed' {
  const { pending, failed } = useServerSaves()
  if (failed) return 'failed'
  return pending ? 'saving' : 'saved'
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

/** Offers more instead of stopping: new items first, then more reviews here, then another module. */
function NextStepsPanel({ skill, units, onRestart, onExit }: Pick<SessionSummaryProps, 'skill' | 'units' | 'onRestart' | 'onExit'>) {
  const s = common.use()
  const n = sessionStrings.use()
  const navigate = useNavigate()
  const lang = useSettings((st) => st.targetLang)
  const sessionSize = useSettings((st) => st.sessionSize)
  const newPerSession = useSettings((st) => st.newPerSession)
  const cards = useProgress((st) => st.cards)
  const next = useMemo(
    () => nextSteps(skill, lang, cards, { sessionSize, newPerSession, units }),
    [skill, lang, cards, sessionSize, newPerSession, units],
  )
  const slug = (k: Skill) => MODULES.find((m) => m.skill === k)!.slug
  const learnNew = next.learnNew
  const startNew = () => {
    if (!learnNew) return
    if (learnNew.skill === skill) onRestart('new')
    else navigate(`/learn/${slug(learnNew.skill)}/session?kind=new`)
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {learnNew ? (
        <Card className="w-full gap-3 border-primary/30 bg-primary/5 py-5">
          <CardContent className="flex flex-col items-center gap-3 px-5">
            <div className="space-y-1">
              <p className="text-lg font-semibold">{n.keepGoing[learnNew.skill]}</p>
              <p className="text-sm text-muted-foreground">{n.ready[learnNew.skill](learnNew.count)}</p>
            </div>
            <Button size="xl" className="w-full" onClick={startNew}>
              <Sparkles /> {n.learnNew[learnNew.skill](learnNew.count)}
            </Button>
          </CardContent>
        </Card>
      ) : (
        next.reviews === 0 && !next.other && <p className="text-sm text-muted-foreground">{n.caughtUp}</p>
      )}
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        {next.reviews > 0 && (
          <Button size="xl" variant="outline" className="sm:flex-1" onClick={() => onRestart('reviews')}>
            <RotateCcw /> {n.reviewMore(next.reviews)}
          </Button>
        )}
        {next.other && (
          <Button size="xl" variant="outline" className="sm:flex-1" onClick={() => navigate(`/learn/${slug(next.other!)}/session`)}>
            {n.continueWith(s.modules[next.other].title)} <ArrowRight className="rtl:rotate-180" />
          </Button>
        )}
        <Button size="xl" variant={learnNew || next.reviews || next.other ? 'ghost' : 'default'} className="sm:flex-1" onClick={onExit}>
          {s.session.home}
        </Button>
      </div>
    </div>
  )
}

export function SessionSummary({ skill, stats, empty, units, onRestart, onExit }: SessionSummaryProps) {
  const s = common.use()
  const p = progressStrings.use()
  const m = medalStrings.use()
  const lang = useSettings((st) => st.targetLang)
  const cards = useProgress((st) => st.cards)
  const award = useAwardMedals()
  const earned = useProgress((st) => st.medals[lang])
  const since = stats.startedAt
  const gain = useMemo(() => sessionGain(skill, lang, cardsBefore(since, cards), cards), [skill, lang, since, cards])
  const [celebration, setCelebration] = useState(() => {
    if (empty) return null
    const have = (getProgress().medals[lang] ?? []).map((e) => e.words)
    const reached = medalsToAward(gain.course.after.learned, gain.course.after.total, have)
    return reached.length ? reached : null
  })
  useEffect(() => {
    if (celebration) award(lang, celebration)
  }, [celebration, award, lang])

  if (empty) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <Sprout className="size-12 text-primary" />
        <h2 className="text-2xl font-semibold">{s.session.empty}</h2>
        <p className="text-muted-foreground">{s.session.emptyHint}</p>
        <NextStepsPanel skill={skill} units={units} onRestart={onRestart} onExit={onExit} />
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
  const nextMedal = nextMilestone(course.after.learned, course.after.total, (earned ?? []).map((e) => e.words))
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
            {nextMedal !== null && (
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Medal className="size-3.5 text-amber-500" /> {m.next(nextMedal - course.after.learned, nextMedal)}
              </p>
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
      <NextStepsPanel skill={skill} units={units} onRestart={onRestart} onExit={onExit} />
      {celebration && (
        <Celebration
          lang={lang}
          words={celebration[celebration.length - 1]}
          total={course.after.total}
          alsoEarned={celebration.length - 1}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
  )
}
