import { Lock, Play } from 'lucide-react'
import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Disclosure } from '@/components/disclosure'
import { units } from '@/content'
import { pictureAreas } from '@/content/pictures'
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
    byArea: 'Practise by area',
    nothing: 'Nothing to practise in this module yet.',
    lockedHint: {
      recognition: '',
      recall: 'Words arrive here once you recognise them reliably (after a few correct answers in Recognition).',
      construction: 'Sentences open once you have met all their words in Recognition.',
      response: 'Questions open once you can recall most of their words.',
      pictures: '',
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
        `What happens after all ${n} words? They stay with you: learned words keep coming back at longer and longer intervals, so they stick for good. They also move on to Recall, where you come up with them yourself, and then to Sentence building and Q&A.`,
      recall: (n: number) =>
        `What happens after all ${n} words? They keep coming back at longer and longer intervals, weeks and then months apart, so they stay in your long-term memory. And you use them in Sentence building and Q&A.`,
      construction: (n: number) =>
        `What happens after all ${n} sentences? They come back now and then so the grammar stays automatic, and Q&A puts the same words to work in conversation.`,
      response: (n: number) =>
        `What happens after all ${n} questions? They come back at longer and longer intervals, so you can keep answering them without thinking.`,
      pictures: (n: number) =>
        `What happens after all ${n} pictures? They come back at longer and longer intervals, so the word comes to you as soon as you see the thing.`,
    },
  },
  sv: {
    start: 'Starta passet',
    due: 'Att repetera nu',
    available: 'Redo att lära in',
    learned: 'Inlärda',
    total: 'Totalt',
    why: 'Därför fungerar det',
    byUnit: 'Öva per enhet',
    byArea: 'Öva per område',
    nothing: 'Inget att öva på i den här modulen än.',
    lockedHint: {
      recognition: '',
      recall: 'Ord kommer hit när du känner igen dem säkert (efter några rätta svar i Igenkänning).',
      construction: 'Meningar låses upp när du har mött alla deras ord i Igenkänning.',
      response: 'Frågor låses upp när du kan plocka fram de flesta av orden i dem.',
      pictures: '',
    },
    noContent: 'Inget innehåll i den här enheten än',
    reviews: 'Så fungerar repetitionerna',
    reviewsBody:
      'Allt du övar kommer tillbaka precis innan du skulle glömma det: först efter några minuter, sedan efter ungefär två dagar, sedan efter en dryg vecka och sedan efter veckor och månader. Svarar du rätt dröjer det längre till nästa gång. Svarar du fel kommer det tillbaka tidigare. Gör du mycket idag behöver du alltså inte göra om allt imorgon, bara några repetitioner utspridda över de kommande dagarna.',
    comingBack: 'Kommer tillbaka',
    laterToday: 'Senare idag',
    tomorrow: 'Imorgon',
    thisWeek: 'I veckan',
    later: 'Senare',
    afterAll: {
      recognition: (n: number) =>
        `Vad händer efter alla ${n} ord? De stannar kvar: inlärda ord fortsätter att komma tillbaka med allt längre mellanrum, så att de fastnar på riktigt. De går också vidare till Minnas, där du plockar fram dem själv, och sedan till Meningsbygge och Frågor & svar.`,
      recall: (n: number) =>
        `Vad händer efter alla ${n} ord? De fortsätter att komma tillbaka med allt längre mellanrum, veckor och sedan månader, så att de stannar i långtidsminnet. Och du använder dem i Meningsbygge och Frågor & svar.`,
      construction: (n: number) =>
        `Vad händer efter alla ${n} meningar? De kommer tillbaka då och då så att grammatiken sitter, och i Frågor & svar använder du samma ord i samtal.`,
      response: (n: number) =>
        `Vad händer efter alla ${n} frågor? De kommer tillbaka med allt längre mellanrum, så att du kan svara utan att tänka efter.`,
      pictures: (n: number) =>
        `Vad händer efter alla ${n} bilder? De kommer tillbaka med allt längre mellanrum, så att ordet dyker upp så fort du ser saken.`,
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
    const groups = meta.skill === 'pictures' ? pictureAreas : units
    return groups.map((u) => {
      const inUnit = items.filter((it) => it.unit === u.id)
      const learned = inUnit.filter((it) => isLearned(cards[cardKey(lang, meta.skill, it.id)])).length
      const started = inUnit.filter((it) => cards[cardKey(lang, meta.skill, it.id)]).length
      const unlocked = inUnit.filter((it) => it.unlock.unlocked || cards[cardKey(lang, meta.skill, it.id)]).length
      return { unit: u, total: inUnit.length, learned, started, unlocked }
    })
  }, [meta, lang, cards])
  const outlook = useMemo(() => (meta ? reviewOutlook(cards, lang, meta.skill, now) : null), [meta, lang, cards, now])

  if (!meta || !outlook || !status) return <Navigate to="/" replace />
  const canStart = status.due > 0 || status.available > 0

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-6 sm:py-10">
      <section className="relative isolate overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
        <span
          aria-hidden
          className={cn('pointer-events-none absolute -bottom-8 end-6 -z-10 font-poster text-[9rem] leading-none sm:-bottom-10 sm:end-10 sm:text-[12rem]', meta.text)}
        >
          {meta.letter[lang]}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">{c.modules[meta.skill].title}</h1>
        <p className="mt-2 max-w-[46ch] text-muted-foreground">{c.modules[meta.skill].description}</p>
        <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3">
          {[
            [s.due, status.due],
            [s.available, status.available],
            [s.learned, status.learned],
            [s.total, status.total],
          ].map(([label, value]) => (
            <div key={label as string} className="flex flex-col-reverse">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <Meter
          learned={status.learned}
          learning={status.started - status.learned}
          total={status.total}
          tone={meta.skill}
          size="xs"
          label={`${s.learned}: ${status.learned}/${status.total}`}
          className="mt-5 max-w-md"
        />
        <div className="mt-7">
          {canStart ? (
            <Button asChild size="xl" className="w-full sm:w-auto">
              <Link to={`/learn/${meta.slug}/session`}>
                <Play /> {s.start}
              </Link>
            </Button>
          ) : (
            <p className="flex max-w-[46ch] items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" />
              {s.lockedHint[meta.skill] || s.nothing}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">{s.reviews}</h2>
        {status.started > 0 && (
          <div>
            <h3 className="text-sm text-muted-foreground">{s.comingBack}</h3>
            <dl className="mt-1.5 flex flex-wrap gap-x-8 gap-y-2">
              {(
                [
                  [s.laterToday, outlook.laterToday],
                  [s.tomorrow, outlook.tomorrow],
                  [s.thisWeek, outlook.thisWeek],
                  [s.later, outlook.later],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{s.reviewsBody}</p>
        <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{s.afterAll[meta.skill](status.total)}</p>
        <Disclosure label={s.why} className="max-w-[60ch]">
          <p className="text-sm leading-relaxed text-muted-foreground">{why[meta.skill]}</p>
        </Disclosure>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{meta.skill === 'pictures' ? s.byArea : s.byUnit}</h2>
        <ul className="grid rounded-2xl border bg-card sm:grid-cols-2">
          {perUnit.map(({ unit, total, learned, started, unlocked }) => (
            <li key={unit.id} className="border-b last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0 sm:odd:border-e">
              <div className="flex items-center gap-3 py-3 ps-5 pe-3">
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
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
