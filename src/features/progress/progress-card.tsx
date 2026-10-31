import { CalendarCheck, ChartNoAxesColumn, Flame } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { moduleBySkill } from '@/features/modules'
import { dayKey, streak, useProgress } from '@/store/progress'
import { Meter } from './meter'
import { courseProgress, moduleProgress, pct, type Bar, type ModuleProgress } from './progress-data'
import { progressStrings } from './strings'

export function CourseSummary({ lang, course, size = 'lg' }: { lang: TargetLang; course: Bar; size?: 'md' | 'lg' }) {
  const s = progressStrings.use()
  const c = common.use()
  const started = course.learned + course.learning > 0
  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('font-semibold', size === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg')}>
            {s.know(course.learned, course.total)}
          </p>
          <p className="text-sm text-muted-foreground">
            {started ? (course.learning > 0 ? s.onTheWay(course.learning) : c.languages[lang]) : s.notStarted}
          </p>
        </div>
        <span className={cn('shrink-0 font-semibold tabular-nums text-primary', size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl')}>
          {pct(course.learned, course.total)}%
        </span>
      </div>
      <Meter
        learned={course.learned}
        learning={course.learning}
        total={course.total}
        size={size === 'lg' ? 'lg' : 'md'}
        label={s.know(course.learned, course.total)}
      />
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

export function ModuleBars({ modules, linked = true }: { modules: ModuleProgress[]; linked?: boolean }) {
  const s = progressStrings.use()
  const c = common.use()
  return (
    <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
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
                {status.learned}/{status.total}
              </span>
            </div>
            <Meter
              learned={status.learned}
              learning={status.started - status.learned}
              total={status.total}
              tone={skill}
              size="xs"
              label={s.moduleLabel(c.nav[skill], status.learned, status.total)}
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

/** The home page headline: how much of the course is known, per module, and today. */
export function ProgressCard({ lang, greeting, action }: ProgressCardProps) {
  const s = progressStrings.use()
  const c = common.use()
  const cards = useProgress((st) => st.cards)
  const days = useProgress((st) => st.days)
  const [now] = useState(() => new Date())
  const course = useMemo(() => courseProgress(lang, cards), [lang, cards])
  const modules = useMemo(() => moduleProgress(lang, cards, now), [lang, cards, now])
  const due = modules.reduce((n, m) => n + m.status.due, 0)
  const today = days[dayKey(now)]?.reviews ?? 0
  const currentStreak = streak(days, now)

  return (
    <section aria-labelledby="course-title" className="animate-pop-in space-y-5 rounded-3xl border bg-card p-5 shadow-xs sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          {greeting && (
            <p lang={lang} dir="rtl" className="font-script text-3xl leading-tight text-primary">
              {greeting}
            </p>
          )}
          <h1 id="course-title" className="text-sm font-medium text-muted-foreground">
            {s.courseTitle(c.languagesShort[lang])}
          </h1>
        </div>
        <Link
          to="/progress"
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-primary hover:bg-primary/10"
        >
          <ChartNoAxesColumn className="size-4" /> {s.seeAll}
        </Link>
      </div>

      <CourseSummary lang={lang} course={course} />

      <ModuleBars modules={modules} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-sm">
        <span className="flex items-center gap-1.5">
          <CalendarCheck className="size-4 text-muted-foreground" />
          <span className="font-medium">{s.today}:</span> {s.reviewsDone(today)}
        </span>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', due ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
          {s.dueNow(due)}
        </span>
        <span
          className={cn(
            'flex items-center gap-1 font-medium',
            currentStreak ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
          )}
        >
          <Flame className="size-4" /> {s.streak(currentStreak)}
        </span>
      </div>

      {action}
    </section>
  )
}
