import { ArrowRight, Lock } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { pictureAreas, pictureUrl, picturesFor } from '@/content/pictures'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { moduleStatus, type ModuleStatus } from '@/lib/curriculum'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { MODULES, PICTURES_MODULE, type PathModule } from '@/features/modules'
import { ProgressCard } from '@/features/progress/progress-card'
import { sessionStrings } from '@/features/session/strings'
import { WhatsNewBanner } from '@/features/whats-new/whats-new-banner'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { Onboarding } from './onboarding'
import { homeStrings } from './strings'

const CARD_HOVER =
  'transition-[translate,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 motion-reduce:hover:translate-y-0'

/** The line from one step to the next: solid once the next step is open, dashed while it's locked. */
function Connector({ open, tone }: { open: boolean; tone: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute start-[2.3125rem] top-full h-3 sm:hidden lg:start-full lg:top-[2.5625rem] lg:block lg:w-6',
        open ? cn(tone, 'w-0.5 lg:h-0.5') : 'w-0 border-dashed border-muted-foreground/40 max-lg:border-s-2 lg:h-0 lg:border-t-2',
      )}
    />
  )
}

function ModuleStep({ meta, status, next }: { meta: PathModule; status: ModuleStatus; next?: ModuleStatus }) {
  const c = common.use()
  const s = homeStrings.use()
  const locked = status.unlocked === 0
  const Icon = meta.icon
  return (
    <li className="relative flex">
      <Link
        to={`/learn/${meta.slug}`}
        className={cn('group flex flex-1 gap-4 rounded-3xl border bg-card p-4 shadow-xs sm:flex-col sm:gap-3 sm:p-5', CARD_HOVER, locked && 'opacity-75')}
      >
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl text-white transition-transform duration-300 ease-out-expo group-hover:scale-105', meta.bg)}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold">
            <span className="sr-only">{s.step(meta.step)}: </span>
            {c.modules[meta.skill].title}
          </h3>
          <p className="text-sm text-muted-foreground">{c.modules[meta.skill].short}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {locked ? (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Lock className="size-3.5" /> {s.locked}
              </span>
            ) : (
              <StatusBadges status={status} bg={meta.bg} />
            )}
          </div>
        </div>
      </Link>
      {next && <Connector open={next.unlocked > 0} tone={meta.bg} />}
    </li>
  )
}

function StatusBadges({ status, bg }: { status: ModuleStatus; bg: string }) {
  const c = common.use()
  return (
    <>
      {status.due > 0 && <span className={cn('rounded-full px-2 py-0.5 font-medium text-white', bg)}>{c.due(status.due)}</span>}
      {status.available > 0 && <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{c.available(status.available)}</span>}
    </>
  )
}

function PicturesCard({ status }: { status: ModuleStatus }) {
  const c = common.use()
  const l = useLocalize()
  const lang = useSettings((st) => st.targetLang)
  const meta = PICTURES_MODULE
  const Icon = meta.icon
  const previews = useMemo(() => {
    const all = picturesFor(lang)
    return pictureAreas.flatMap((a) => all.find((p) => p.area === a.id) ?? []).slice(0, 4)
  }, [lang])
  return (
    <Link
      to={`/learn/${meta.slug}`}
      className={cn('group flex flex-col gap-4 rounded-3xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:p-5', CARD_HOVER)}
    >
      <div className="flex min-w-0 flex-1 gap-4">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl text-white', meta.bg)}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold">{c.modules.pictures.title}</h3>
          <p className="text-sm text-muted-foreground">{c.modules.pictures.description}</p>
          <ul className="flex flex-wrap gap-1.5 pt-1 text-xs">
            {pictureAreas.map((a) => (
              <li key={a.id} className={cn('rounded-full px-2 py-0.5', meta.soft)}>
                <span aria-hidden>{a.emoji}</span> {l(a.title)}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <StatusBadges status={status} bg={meta.bg} />
          </div>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-1.5 sm:w-64" aria-hidden>
        {previews.map((p) => (
          <img key={p.id} src={pictureUrl(p)} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
        ))}
      </div>
    </Link>
  )
}

export function HomePage() {
  const c = common.use()
  const s = homeStrings.use()
  const n = sessionStrings.use()
  const lang = useSettings((st) => st.targetLang)
  const onboarded = useSettings((st) => st.onboarded)
  const cards = useProgress((st) => st.cards)
  const now = useNow()

  const statuses = useMemo(() => MODULES.map((m) => moduleStatus(m.skill, lang, cards, now)), [lang, cards, now])
  const next = MODULES.find((_, i) => statuses[i].due > 0) ?? MODULES.find((_, i) => statuses[i].available > 0)
  const fresh = statuses.every((st) => st.started === 0)

  const nothingDue = statuses.every((st) => st.due === 0)
  const picturesStatus = useMemo(() => moduleStatus('pictures', lang, cards, now), [lang, cards, now])

  const action = next ? (
    <div className="flex flex-col gap-2">
      {nothingDue && !fresh && <p className="text-sm text-muted-foreground">{n.noReviews}</p>}
      <Button asChild size="xl" className="w-full sm:w-auto">
        <Link to={`/learn/${next.slug}/session`}>
          {fresh ? s.start : `${s.continue}: ${c.modules[next.skill].title}`} <ArrowRight className="rtl:rotate-180" />
        </Link>
      </Button>
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">{s.allDone}</p>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-10">
      {!onboarded && <Onboarding />}

      <div className="space-y-3">
        {onboarded && <WhatsNewBanner />}
        <ProgressCard lang={lang} greeting={s.hello[lang]} action={action} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{s.path}</h2>
          <p className="text-sm text-muted-foreground">{s.pathHint}</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {MODULES.map((m, i) => (
            <ModuleStep key={m.skill} meta={m} status={statuses[i]} next={statuses[i + 1]} />
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{s.more}</h2>
          <p className="text-sm text-muted-foreground">{s.moreHint}</p>
        </div>
        <PicturesCard status={picturesStatus} />
      </section>
    </div>
  )
}
