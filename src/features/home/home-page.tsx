import { ArrowRight, Lock } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { common } from '@/i18n/common'
import { moduleStatus, type ModuleStatus } from '@/lib/curriculum'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { MODULES, type ModuleMeta } from '@/features/modules'
import { ProgressCard } from '@/features/progress/progress-card'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { Onboarding } from './onboarding'
import { homeStrings } from './strings'

function ModuleStep({ meta, status }: { meta: ModuleMeta; status: ModuleStatus }) {
  const c = common.use()
  const s = homeStrings.use()
  const locked = status.unlocked === 0
  const Icon = meta.icon
  return (
    <Link
      to={`/learn/${meta.slug}`}
      className={cn(
        'group relative flex gap-4 rounded-3xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md sm:flex-col sm:gap-3 sm:p-5',
        locked && 'opacity-75',
      )}
    >
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl text-white', meta.bg)}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{s.step(meta.step)}</span>
        <h3 className="font-semibold">{c.modules[meta.skill].title}</h3>
        <p className="text-sm text-muted-foreground">{c.modules[meta.skill].short}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {locked ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Lock className="size-3.5" /> {s.locked}
            </span>
          ) : (
            <>
              {status.due > 0 && <span className={cn('rounded-full px-2 py-0.5 font-medium text-white', meta.bg)}>{c.due(status.due)}</span>}
              {status.available > 0 && <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{c.available(status.available)}</span>}
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

export function HomePage() {
  const c = common.use()
  const s = homeStrings.use()
  const lang = useSettings((st) => st.targetLang)
  const onboarded = useSettings((st) => st.onboarded)
  const cards = useProgress((st) => st.cards)
  const now = useNow()

  const statuses = useMemo(() => MODULES.map((m) => moduleStatus(m.skill, lang, cards, now)), [lang, cards, now])
  const next = MODULES.find((_, i) => statuses[i].due > 0) ?? MODULES.find((_, i) => statuses[i].available > 0)
  const fresh = statuses.every((st) => st.started === 0)

  const action = next ? (
    <Button asChild size="xl" className="w-full sm:w-auto">
      <Link to={`/learn/${next.slug}/session`}>
        {fresh ? s.start : `${s.continue}: ${c.modules[next.skill].title}`} <ArrowRight className="rtl:rotate-180" />
      </Link>
    </Button>
  ) : (
    <p className="text-sm text-muted-foreground">{s.allDone}</p>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-10">
      {!onboarded && <Onboarding />}

      <div className="mx-auto max-w-3xl">
        <ProgressCard lang={lang} greeting={s.hello[lang]} action={action} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{s.path}</h2>
          <p className="text-sm text-muted-foreground">{s.pathHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <ModuleStep key={m.skill} meta={m} status={statuses[i]} />
          ))}
        </div>
      </section>
    </div>
  )
}
