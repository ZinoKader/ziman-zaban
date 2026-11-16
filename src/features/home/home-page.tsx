import { ArrowRight, Lock } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { pictureAreas, pictureUrl, picturesFor } from '@/content/pictures'
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

const CARD =
  'group relative isolate flex overflow-hidden rounded-2xl border bg-card p-5 transition-[translate,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-foreground/20 active:translate-y-0 motion-reduce:hover:translate-y-0'

function ModuleStep({ meta, status }: { meta: PathModule; status: ModuleStatus }) {
  const c = common.use()
  const s = homeStrings.use()
  const lang = useSettings((st) => st.targetLang)
  const locked = status.unlocked === 0
  return (
    <li className="flex">
      <Link to={`/learn/${meta.slug}`} className={cn(CARD, 'min-h-44 flex-1 flex-col sm:min-h-48')}>
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute -bottom-5 end-4 -z-10 font-poster text-[6.5rem] leading-none transition-transform duration-500 ease-out-expo group-hover:-translate-y-1 sm:text-[7.5rem]',
            meta.text,
            locked && 'opacity-30',
          )}
        >
          {meta.letter[lang]}
        </span>
        <h3 className="font-medium">
          <span className="sr-only">{s.step(meta.step)}: </span>
          {c.modules[meta.skill].title}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{c.modules[meta.skill].short}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          {locked ? (
            <>
              <Lock className="size-3.5" /> {s.locked}
            </>
          ) : (
            <StatusLine status={status} />
          )}
        </p>
      </Link>
    </li>
  )
}

function StatusLine({ status }: { status: ModuleStatus }) {
  const c = common.use()
  return (
    <>
      {status.due > 0 && <span className="font-medium text-foreground">{c.due(status.due)}</span>}
      {status.due > 0 && status.available > 0 && <span aria-hidden>·</span>}
      {status.available > 0 && <span>{c.available(status.available)}</span>}
    </>
  )
}

function PicturesCard({ status }: { status: ModuleStatus }) {
  const c = common.use()
  const lang = useSettings((st) => st.targetLang)
  const previews = useMemo(() => {
    const all = picturesFor(lang)
    return pictureAreas.flatMap((a) => all.find((p) => p.area === a.id) ?? []).slice(0, 4)
  }, [lang])
  return (
    <Link to={`/learn/${PICTURES_MODULE.slug}`} className={cn(CARD, 'flex-col gap-5 sm:flex-row sm:items-center')}>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">{c.modules.pictures.title}</h3>
        <p className="mt-0.5 max-w-[60ch] text-sm text-muted-foreground">{c.modules.pictures.description}</p>
        <p className="mt-4 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <StatusLine status={status} />
        </p>
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-1.5 sm:w-60" aria-hidden>
        {previews.map((p) => (
          <img key={p.id} src={pictureUrl(p)} alt="" loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
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
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 sm:py-10">
      {!onboarded && <Onboarding />}

      <div className="space-y-3">
        {onboarded && <WhatsNewBanner />}
        <ProgressCard lang={lang} greeting={s.hello[lang]} action={action} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{s.path}</h2>
        <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <ModuleStep key={m.skill} meta={m} status={statuses[i]} />
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{s.more}</h2>
        <PicturesCard status={picturesStatus} />
      </section>
    </div>
  )
}
