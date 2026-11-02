import { CalendarClock, Lightbulb, Lock, Play } from 'lucide-react'
import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { units } from '@/content'
import { defineStrings, useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { moduleItems, moduleStatus } from '@/lib/curriculum'
import { cardKey, isLearned } from '@/lib/srs'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { moduleBySlug, moduleWhy } from '@/features/modules'
import { Meter } from '@/features/progress/meter'
import { reviewOutlook } from '@/features/progress/progress-data'
import { progressStrings } from '@/features/progress/strings'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'

const strings = defineStrings({
  en: {
    start: 'Start session',
    due: 'Due now',
    available: 'Ready to learn',
    learned: 'Learned',
    total: 'Total',
    why: 'Why this works',
    byUnit: 'Practise by unit',
    nothing: 'Nothing to practise in this module yet.',
    lockedHint: {
      recognition: '',
      recall: 'Words arrive here once you recognise them reliably (after a few correct answers in Recognition).',
      construction: 'Sentences unlock once you have met all the words they use in Recognition.',
      response: 'Questions unlock once you can recall most of the words they use.',
    },
    noContent: 'No content in this unit yet',
    reviews: 'How reviews work',
    reviewsBody:
      "Everything you practise comes back just before you'd forget it: first after a few minutes, then after about two days, then about a week and a half, then weeks and months. Get it right and the gap grows; miss it and it comes back sooner. So a big session today doesn't mean doing it all again tomorrow, just a few reviews spread over the coming days.",
    comingBack: 'Coming back',
    laterToday: 'Later today',
    tomorrow: 'Tomorrow',
    thisWeek: 'This week',
    later: 'Later',
    afterAll: {
      recognition: (n: number) =>
        `What happens after all ${n} words? They stay with you: learned words keep coming back at longer and longer intervals, so they stick for good. They also move on to Recall, where you produce them yourself, and then into Sentence building and Q&A.`,
      recall: (n: number) =>
        `What happens after all ${n} words? They keep coming back at longer and longer intervals, weeks and then months apart, so they stay in your long-term memory. And you use them in Sentence building and Q&A.`,
      construction: (n: number) =>
        `What happens after all ${n} sentences? They come back now and then so the grammar stays automatic, while Q&A puts the same words to work in real conversations.`,
      response: (n: number) =>
        `What happens after all ${n} questions? They come back at longer and longer intervals, so you can keep answering them without thinking.`,
    },
  },
  sv: {
    start: 'Starta passet',
    due: 'Att repetera nu',
    available: 'Redo att lära',
    learned: 'Inlärda',
    total: 'Totalt',
    why: 'Därför fungerar det',
    byUnit: 'Öva per enhet',
    nothing: 'Inget att öva på i den här modulen än.',
    lockedHint: {
      recognition: '',
      recall: 'Ord kommer hit när du känner igen dem säkert (efter några rätta svar i Igenkänning).',
      construction: 'Meningar låses upp när du har mött alla ord de använder i Igenkänning.',
      response: 'Frågor låses upp när du kan plocka fram de flesta orden de använder.',
    },
    noContent: 'Inget innehåll i den här enheten än',
    reviews: 'Så fungerar repetitionerna',
    reviewsBody:
      'Allt du övar kommer tillbaka precis innan du skulle glömma det: först efter några minuter, sedan efter ungefär två dagar, sedan efter en dryg vecka och sedan efter veckor och månader. Svarar du rätt blir uppehållet längre, svarar du fel kommer det tillbaka snabbare. Gör du mycket idag behöver du alltså inte göra om allt imorgon, bara några repetitioner utspridda över de kommande dagarna.',
    comingBack: 'Kommer tillbaka',
    laterToday: 'Senare idag',
    tomorrow: 'Imorgon',
    thisWeek: 'I veckan',
    later: 'Senare',
    afterAll: {
      recognition: (n: number) =>
        `Vad händer efter alla ${n} ord? De stannar kvar: inlärda ord fortsätter att komma tillbaka med allt längre mellanrum, så att de fastnar på riktigt. De går också vidare till Återkallning, där du plockar fram dem själv, och sedan till Meningsbygge och Frågor & svar.`,
      recall: (n: number) =>
        `Vad händer efter alla ${n} ord? De fortsätter att komma tillbaka med allt längre mellanrum, veckor och sedan månader, så att de stannar i långtidsminnet. Och du använder dem i Meningsbygge och Frågor & svar.`,
      construction: (n: number) =>
        `Vad händer efter alla ${n} meningar? De kommer tillbaka då och då så att grammatiken sitter, medan Frågor & svar använder samma ord i riktiga samtal.`,
      response: (n: number) =>
        `Vad händer efter alla ${n} frågor? De kommer tillbaka med allt längre mellanrum, så att du kan svara utan att tänka efter.`,
    },
  },
})

export function ModulePage() {
  const { module: slug } = useParams()
  const meta = slug ? moduleBySlug.get(slug) : undefined
  const c = common.use()
  const s = strings.use()
  const why = moduleWhy.use()
  const p = progressStrings.use()
  const l = useLocalize()
  const lang = useSettings((st) => st.targetLang)
  const cards = useProgress((st) => st.cards)

  const now = useNow()
  const status = useMemo(() => (meta ? moduleStatus(meta.skill, lang, cards, now) : null), [meta, lang, cards, now])
  const perUnit = useMemo(() => {
    if (!meta) return []
    const items = moduleItems(meta.skill, lang, cards)
    return units.map((u) => {
      const inUnit = items.filter((it) => it.unit === u.id)
      const learned = inUnit.filter((it) => isLearned(cards[cardKey(lang, meta.skill, it.id)])).length
      const started = inUnit.filter((it) => cards[cardKey(lang, meta.skill, it.id)]).length
      const unlocked = inUnit.filter((it) => it.unlock.unlocked || cards[cardKey(lang, meta.skill, it.id)]).length
      return { unit: u, total: inUnit.length, learned, started, unlocked }
    })
  }, [meta, lang, cards])
  const outlook = useMemo(() => (meta ? reviewOutlook(cards, lang, meta.skill, now) : null), [meta, lang, cards, now])

  if (!meta || !outlook || !status) return <Navigate to="/" replace />
  const Icon = meta.icon
  const canStart = status.due > 0 || status.available > 0

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-10">
      <section className={cn('rounded-3xl p-6 ring-1 sm:p-8', meta.soft, meta.ring)}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className={cn('grid size-14 shrink-0 place-items-center rounded-2xl text-white', meta.bg)}>
            <Icon className="size-7" />
          </span>
          <div className="flex-1 space-y-2">
            <h1 className="text-3xl font-semibold">{c.modules[meta.skill].title}</h1>
            <p className="text-muted-foreground">{c.modules[meta.skill].description}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [s.due, status.due],
            [s.available, status.available],
            [s.learned, status.learned],
            [s.total, status.total],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl bg-card/80 px-4 py-3">
              <div className="text-2xl font-semibold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <Meter
          learned={status.learned}
          learning={status.started - status.learned}
          total={status.total}
          tone={meta.skill}
          size="sm"
          label={`${s.learned}: ${status.learned}/${status.total}`}
          className="mt-4 bg-card/80"
        />
        <div className="mt-6">
          {canStart ? (
            <Button asChild size="xl" className={cn('w-full text-white sm:w-auto', meta.bg)}>
              <Link to={`/learn/${meta.slug}/session`}>
                <Play /> {s.start}
              </Link>
            </Button>
          ) : (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" />
              {s.lockedHint[meta.skill] || s.nothing}
            </p>
          )}
        </div>
      </section>

      <section className="flex gap-3 rounded-2xl border bg-card p-5">
        <CalendarClock className={cn('mt-0.5 size-5 shrink-0', meta.text)} />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="font-medium">{s.reviews}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.reviewsBody}</p>
          </div>
          {status.started > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.comingBack}</h3>
              <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    [s.laterToday, outlook.laterToday],
                    [s.tomorrow, outlook.tomorrow],
                    [s.thisWeek, outlook.thisWeek],
                    [s.later, outlook.later],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-col-reverse rounded-xl bg-muted/60 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">{s.afterAll[meta.skill](status.total)}</p>
        </div>
      </section>

      <section className="flex gap-3 rounded-2xl border bg-card p-5">
        <Lightbulb className={cn('mt-0.5 size-5 shrink-0', meta.text)} />
        <div>
          <h2 className="font-medium">{s.why}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{why[meta.skill]}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{s.byUnit}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {perUnit.map(({ unit, total, learned, started, unlocked }) => (
            <Card key={unit.id} className="py-4">
              <CardContent className="flex items-center gap-3 px-4">
                <span className="text-2xl" aria-hidden>{unit.emoji}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-medium">{l(unit.title)}</h3>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {total ? p.counts(learned, started - learned, total) : s.noContent}
                    </span>
                  </div>
                  <Meter
                    learned={learned}
                    learning={started - learned}
                    total={total}
                    tone={meta.skill}
                    size="xs"
                    label={`${l(unit.title)}: ${learned}/${total}`}
                  />
                </div>
                <Button asChild variant="ghost" size="icon" disabled={!unlocked} aria-label={c.actions.practice}>
                  {unlocked ? (
                    <Link to={`/learn/${meta.slug}/session?unit=${unit.id}`}>
                      <Play />
                    </Link>
                  ) : (
                    <span>
                      <Lock className="opacity-40" />
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
