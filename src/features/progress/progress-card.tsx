import { ChevronRight, Flame } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { moduleBySkill } from '@/features/modules'
import { dayKey, scopedDays, streak, useProgress } from '@/store/progress'
import { Meter } from './meter'
import { courseProgress, moduleProgress, pct, type Bar, type ModuleProgress } from './progress-data'
import { progressStrings } from './strings'

const EMPTY = { learned: 0, learning: 0 }

interface CourseSummaryProps {
  course: Bar
  size?: 'md' | 'lg'
  /** Fill the meter from empty when it first shows. */
  grow?: boolean
}

export function CourseSummary({ course, size = 'lg', grow }: CourseSummaryProps) {
  const s = progressStrings.use()
  const started = course.learned + course.learning > 0
  const note = started ? (course.learning > 0 ? s.onTheWay(course.learning) : '') : s.notStarted
  const meter = (
    <Meter
      learned={course.learned}
      learning={course.learning}
      total={course.total}
      size={size === 'lg' ? 'sm' : 'md'}
      label={s.know(course.learned, course.total)}
      from={grow ? EMPTY : undefined}
    />
  )
  if (size === 'lg') {
    return (
      <div className="space-y-3">
        <p className="text-2xl font-medium tracking-tight sm:text-3xl">{s.know(course.learned, course.total)}</p>
        {meter}
        <div className="flex justify-between gap-3 text-sm text-muted-foreground">
          <span>{note}</span>
          <span className="tabular-nums">{pct(course.learned, course.total)}%</span>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-medium">{s.know(course.learned, course.total)}</p>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>
        <span className="shrink-0 text-2xl font-medium">{pct(course.learned, course.total)}%</span>
      </div>
      {meter}
      {course.learning > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary" /> {s.learned}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary/25" /> {s.learning}
          </span>
        </div>
      )}
    </div>
  )
}

interface ModuleBarsProps {
  modules: ModuleProgress[]
  linked?: boolean
  grow?: boolean
  className?: string
}

export function ModuleBars({ modules, linked = true, grow, className }: ModuleBarsProps) {
  const s = progressStrings.use()
  const c = common.use()
  return (
    <ul className={cn('grid gap-x-6 gap-y-3 @md:grid-cols-2', className)}>
      {modules.map(({ skill, status }) => {
        const meta = moduleBySkill.get(skill)!
        const Icon = meta.icon
        const body = (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <Icon className={cn('size-4 shrink-0', meta.text)} />
                <span className="truncate">{c.nav[skill]}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {s.counts(status.learned, status.started - status.learned, status.total)}
              </span>
            </div>
            <Meter
              learned={status.learned}
              learning={status.started - status.learned}
              total={status.total}
              tone={skill}
              size="xs"
              label={s.moduleLabel(c.nav[skill], status.learned, status.total)}
              from={grow ? EMPTY : undefined}
            />
          </>
        )
        return (
          <li key={skill}>
            {linked ? (
              <Link to={`/learn/${meta.slug}`} className="block space-y-1.5 rounded-lg outline-offset-4">
                {body}
              </Link>
            ) : (
              <div className="space-y-1.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

interface ProgressCardProps {
  lang: TargetLang
  greeting?: string
  action?: React.ReactNode
}

/** The home page headline: how much of the course is known, and today. */
export function ProgressCard({ lang, greeting, action }: ProgressCardProps) {
  const s = progressStrings.use()
  const c = common.use()
  const cards = useProgress((st) => st.cards)
  const days = useProgress((st) => scopedDays(st, lang))
  const now = useNow()
  const course = useMemo(() => courseProgress(lang, cards), [lang, cards])
  const modules = useMemo(() => moduleProgress(lang, cards, now), [lang, cards, now])
  const due = modules.reduce((n, m) => n + m.status.due, 0)
  const today = days[dayKey(now)]?.reviews ?? 0
  const currentStreak = streak(days, now)

  return (
    <section
      aria-labelledby="course-title"
      className="grid animate-pop-in gap-6 rounded-2xl border bg-card p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-16"
    >
      {greeting && (
        <p
          lang={lang}
          dir="rtl"
          className="w-fit font-poster text-7xl leading-none text-primary md:order-last md:self-center md:pe-6 md:text-[8.5rem]"
        >
          {greeting}
        </p>
      )}
      <div className="max-w-xl space-y-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 id="course-title" className="text-sm text-muted-foreground">
            {s.courseTitle(c.languagesShort[lang])}
          </h1>
          <Link
            to="/progress"
            className="-me-2 flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {s.seeAll} <ChevronRight className="size-4 rtl:rotate-180" />
          </Link>
        </div>
        <CourseSummary course={course} grow />
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            {s.today}: <span>{s.reviewsDone(today)}</span>
          </span>
          <span className={cn(due > 0 && 'font-medium text-foreground')}>{s.dueNow(due)}</span>
          <span className="flex items-center gap-1">
            <Flame className={cn('size-3.5', currentStreak && 'text-mod-recognition')} /> {s.streak(currentStreak)}
          </span>
        </p>
        {action}
      </div>
    </section>
  )
}
