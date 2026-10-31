import { ArrowRight, Flame, Lock } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { conceptsFor, units } from '@/content'
import { defineStrings, useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { moduleStatus, type ModuleStatus } from '@/lib/curriculum'
import { cardKey } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { MODULES, type ModuleMeta } from '@/features/modules'
import { dayKey, streak, useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { Onboarding } from './onboarding'

const strings = defineStrings({
  en: {
    hello: { ckb: 'سڵاو', fa: 'سلام' },
    path: 'From words to conversation',
    pathHint: 'Each step unlocks as you master the one before it.',
    continue: 'Continue',
    today: (n: number) => `${n} reviews today`,
    units: 'Units',
    words: (a: number, b: number) => `${a}/${b} words`,
    learned: (a: number, b: number) => `${a} of ${b} learned`,
    step: (n: number) => `Step ${n}`,
    allDone: "You're all caught up. Come back later for reviews, or learn new words.",
  },
  sv: {
    hello: { ckb: 'سڵاو', fa: 'سلام' },
    path: 'Från ord till samtal',
    pathHint: 'Varje steg låses upp när du behärskar det föregående.',
    continue: 'Fortsätt',
    today: (n: number) => `${n} repetitioner idag`,
    units: 'Enheter',
    words: (a: number, b: number) => `${a}/${b} ord`,
    learned: (a: number, b: number) => `${a} av ${b} inlärda`,
    step: (n: number) => `Steg ${n}`,
    allDone: 'Du är i fas. Kom tillbaka senare för repetitioner, eller lär dig nya ord.',
  },
})

function ModuleStep({ meta, status }: { meta: ModuleMeta; status: ModuleStatus }) {
  const c = common.use()
  const s = strings.use()
  const locked = status.unlocked === 0
  const Icon = meta.icon
  return (
    <Link
      to={`/learn/${meta.slug}`}
      className={cn(
        'group relative flex flex-col gap-3 rounded-3xl border-2 bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md',
        locked && 'opacity-80',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('grid size-11 place-items-center rounded-2xl text-white', meta.bg)}>
          <Icon className="size-6" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{s.step(meta.step)}</span>
      </div>
      <div>
        <h3 className="text-lg font-semibold">{c.modules[meta.skill].title}</h3>
        <p className="text-sm text-muted-foreground">{c.modules[meta.skill].description}</p>
      </div>
      <div className="mt-auto space-y-2">
        <Progress value={status.total ? (status.learned / status.total) * 100 : 0} className="h-2" />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {locked ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Lock className="size-3.5" /> {s.learned(0, status.total)}
            </span>
          ) : (
            <>
              {status.due > 0 && <span className={cn('rounded-full px-2 py-0.5 font-medium text-white', meta.bg)}>{c.due(status.due)}</span>}
              {status.available > 0 && <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{c.available(status.available)}</span>}
              <span className="text-muted-foreground">{s.learned(status.learned, status.total)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

export function HomePage() {
  const c = common.use()
  const s = strings.use()
  const l = useLocalize()
  const { targetLang: lang, onboarded } = useSettings()
  const cards = useProgress((st) => st.cards)
  const days = useProgress((st) => st.days)

  const statuses = useMemo(() => MODULES.map((m) => moduleStatus(m.skill, lang, cards)), [lang, cards])
  const next =
    MODULES.find((_, i) => statuses[i].due > 0) ?? MODULES.find((_, i) => statuses[i].available > 0)
  const todayReviews = days[dayKey(new Date())]?.reviews ?? 0
  const currentStreak = streak(days)

  const unitProgress = useMemo(
    () =>
      units.map((u) => {
        const words = conceptsFor(lang).filter((cpt) => cpt.unit === u.id)
        const known = words.filter((w) => cards[cardKey(lang, 'recognition', w.id)]).length
        return { unit: u, total: words.length, known }
      }),
    [lang, cards],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-10">
      {!onboarded && <Onboarding />}

      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p lang={lang} className="font-script text-4xl text-primary sm:text-5xl">{s.hello[lang]}</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{c.languages[lang]}</h1>
          <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            {currentStreak > 0 && (
              <span className="flex items-center gap-1 font-medium text-orange-600 dark:text-orange-400">
                <Flame className="size-4" /> {c.streak(currentStreak)}
              </span>
            )}
            <span>{s.today(todayReviews)}</span>
          </p>
        </div>
        {next ? (
          <Button asChild size="xl" className="sm:w-auto">
            <Link to={`/learn/${next.slug}/session`}>
              {s.continue}: {c.modules[next.skill].title} <ArrowRight className="rtl:rotate-180" />
            </Link>
          </Button>
        ) : (
          <p className="max-w-sm text-sm text-muted-foreground">{s.allDone}</p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{s.path}</h2>
          <p className="text-sm text-muted-foreground">{s.pathHint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <ModuleStep key={m.skill} meta={m} status={statuses[i]} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{s.units}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {unitProgress.map(({ unit, total, known }) => (
            <Card key={unit.id} className={cn('py-4', total === 0 && 'opacity-60')}>
              <CardContent className="flex items-start gap-3 px-4">
                <span className="text-3xl" aria-hidden>{unit.emoji}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-medium">{l(unit.title)}</h3>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.words(known, total)}</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{l(unit.canDo)}</p>
                  <Progress value={total ? (known / total) * 100 : 0} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
