import { ArrowRight, CircleCheck, Lock } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { MedalShelf } from '@/features/medals/medal-shelf'
import { dayKey, scopedDays, streak, useProgress, useReviewLog, type StatsScope } from '@/store/progress'
import { useServerSaves } from '@/data/server-saves'
import { useSettings } from '@/store/settings'
import { ActivityCard } from './activity-card'
import { DayCard, type LogState } from './day-card'
import { formatWhen, periodLabel, shortDate, weekday } from './format'
import { Highlights, ModulesCard, RecordsCard, WhenCard, WordsCard } from './insights'
import { answersBetween, answersOf, parseDay, recordsOf } from './stats-data'
import { useStatsView } from './stats-params'
import { YearCalendar } from './year-calendar'
import { Meter } from './meter'
import { CourseSummary, ModuleBars } from './progress-card'
import {
  courseProgress,
  dueNow,
  forecast,
  hardestWords,
  moduleProgress,
  startedLanguages,
  unitProgress,
  type UnitProgress,
} from './progress-data'
import { progressStrings } from './strings'

const SCRIPT_NAME: Record<TargetLang, string> = { ckb: 'کوردی', fa: 'فارسی' }

function LanguageCourse({ lang, current }: { lang: TargetLang; current: boolean }) {
  const s = progressStrings.use()
  const c = common.use()
  const set = useSettings((st) => st.set)
  const cards = useProgress((st) => st.cards)
  const course = useMemo(() => courseProgress(lang, cards), [lang, cards])
  const now = useNow()
  const modules = useMemo(() => moduleProgress(lang, cards, now), [lang, cards, now])
  return (
    <Card className={cn(current && 'ring-2 ring-primary/30')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span lang={lang} dir="rtl" className="font-script text-2xl text-primary">{SCRIPT_NAME[lang]}</span>
          <span>{c.languages[lang]}</span>
          {current && <span className="ms-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{s.current}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="@container space-y-5">
        <CourseSummary lang={lang} course={course} size="md" />
        <ModuleBars modules={modules} linked={current} />
        {!current && (
          <Button variant="outline" onClick={() => set({ targetLang: lang })}>
            {s.switchTo} <ArrowRight className="rtl:rotate-180" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function ColumnChart({
  data,
  label,
  barLabel,
  highlight,
  tone,
}: {
  data: Array<{ key: string; date: Date; value: number }>
  label: string
  barLabel: (day: string, n: number) => string
  highlight: string
  tone: string
}) {
  const baseLang = useSettings((st) => st.baseLang)
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ol aria-label={label} className="flex h-32 items-end gap-1 sm:gap-1.5">
      {data.map((d) => (
        <li key={d.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[0.65rem] tabular-nums text-muted-foreground">{d.value || ''}</span>
          <div
            className={cn('w-full rounded-t-md', d.value ? tone : 'bg-muted', d.key === highlight && 'ring-2 ring-ring/40')}
            style={{ height: d.value ? `${Math.max(6, (d.value / max) * 100)}%` : '3px' }}
            title={barLabel(shortDate(d.date, baseLang), d.value)}
          />
          <span className="sr-only">{barLabel(shortDate(d.date, baseLang), d.value)}</span>
          <span aria-hidden className={cn('text-[0.65rem] text-muted-foreground', d.key === highlight && 'font-semibold text-foreground')}>
            {weekday(d.date, baseLang, 'narrow')}
          </span>
        </li>
      ))}
    </ol>
  )
}

function UnitRow({ p }: { p: UnitProgress }) {
  const s = progressStrings.use()
  const l = useLocalize()
  const { unit, words, sentences, questions, state } = p
  const count = s.unitWords(words.learned, words.total, words.learning)
  return (
    <li className={cn('flex items-start gap-3 rounded-2xl border bg-card p-4', state === 'upcoming' && 'bg-card/60')}>
      <span className="text-3xl leading-none" aria-hidden>{unit.emoji}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate font-medium">{l(unit.title)}</h3>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span>
        </div>
        <Meter learned={words.learned} learning={words.learning} total={words.total} size="xs" label={`${l(unit.title)}: ${count}`} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={cn('font-medium', state === 'done' && 'text-success', state === 'active' && 'text-foreground')}>
            {state === 'done' && <CircleCheck className="me-1 inline size-3.5 align-[-2px]" />}
            {s.unitState[state]}
          </span>
          {sentences.total > 0 && (
            <span className="flex items-center gap-1">
              {sentences.unlocked === 0 && <Lock className="size-3" />}
              {s.unitSentences(sentences.unlocked, sentences.total)}
            </span>
          )}
          {questions.total > 0 && (
            <span className="flex items-center gap-1">
              {questions.unlocked === 0 && <Lock className="size-3" />}
              {s.unitQuestions(questions.unlocked, questions.total)}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}

function isScope(v: string | null, langs: readonly TargetLang[]): v is StatsScope {
  return v === 'all' ? langs.length > 1 : langs.includes(v as TargetLang)
}

export function ProgressPage() {
  const s = progressStrings.use()
  const c = common.use()
  const lang = useSettings((st) => st.targetLang)
  const baseLang = useSettings((st) => st.baseLang)
  const cards = useProgress((st) => st.cards)
  const lastSavedAt = useServerSaves((st) => st.lastSavedAt)
  const [params, setParams] = useSearchParams()

  const now = useNow()
  const langs = useMemo(() => {
    const started = startedLanguages(cards)
    return [lang, ...started.filter((x) => x !== lang)]
  }, [cards, lang])
  const requested = params.get('stats')
  const scope: StatsScope = isScope(requested, langs) ? requested : lang
  const scopeLangs = useMemo(() => (scope === 'all' ? langs : [scope]), [scope, langs])
  const chooseScope = (v: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (v === lang) next.delete('stats')
        else next.set('stats', v)
        return next
      },
      { replace: true },
    )

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">{s.title}</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-success" />
          {s.intro}
          {lastSavedAt && <span className="hidden sm:inline"> · {s.lastSaved(formatWhen(lastSavedAt, baseLang, s.justNow, now))}</span>}
        </p>
      </header>

      {langs.length > 1 ? (
        <Tabs value={scope} onValueChange={chooseScope} className="gap-6">
          <TabsList aria-label={s.scope.label} className="w-full sm:w-fit">
            {langs.map((x) => (
              <TabsTrigger key={x} value={x} className="px-4">
                {c.languagesShort[x]}
              </TabsTrigger>
            ))}
            <TabsTrigger value="all" className="px-4">
              {s.scope.all}
            </TabsTrigger>
          </TabsList>
          <TabsContent value={scope} className="text-base">
            <ScopedProgress scope={scope} langs={scopeLangs} />
          </TabsContent>
        </Tabs>
      ) : (
        <ScopedProgress scope={scope} langs={scopeLangs} />
      )}
    </div>
  )
}

/** Everything on the progress page below the header, for one language or several together. */
function ScopedProgress({ scope, langs }: { scope: StatsScope; langs: TargetLang[] }) {
  const s = progressStrings.use()
  const c = common.use()
  const l = useLocalize()
  const current = useSettings((st) => st.targetLang)
  const baseLang = useSettings((st) => st.baseLang)
  const cards = useProgress((st) => st.cards)
  const days = useProgress((st) => scopedDays(st, scope))
  const now = useNow()
  const today = dayKey(now)
  const single = langs.length === 1 ? langs[0] : null

  const coming = useMemo(() => forecast(cards, langs, now, 7), [cards, langs, now])
  const perUnit = useMemo(() => (single ? unitProgress(single, cards) : []), [cards, single])
  const hardest = useMemo(() => hardestWords(cards, langs, 8), [cards, langs])
  const due = useMemo(() => dueNow(langs, cards, now), [cards, langs, now])
  const comingTotal = coming.reduce((n, d) => n + d.count, 0)

  const midnight = useMemo(() => parseDay(today), [today])
  const [view, setView] = useStatsView(now)
  const reviewLog = useReviewLog()
  const answers = useMemo(() => reviewLog.data && answersOf(reviewLog.data, langs), [reviewLog.data, langs])
  const log: LogState = { answers, failed: reviewLog.isError && !answers, retry: () => void reviewLog.refetch() }
  const inPeriod = useMemo(() => answers && answersBetween(answers, view.period.start, view.period.end), [answers, view.period.start, view.period.end])
  const records = useMemo(() => recordsOf(days), [days])
  const periodName = periodLabel(view.range, view.period.start, view.period.end, baseLang)
  const selectDay = (day: string) => setView({ day })

  return (
    <div className="space-y-8">
      <Highlights streakNow={streak(days, now)} records={records} todayStats={days[today]} due={due} />

      <section className="space-y-4">
        <ActivityCard days={days} period={view.period} metric={view.metric} day={view.day} today={midnight} onChange={setView} />
        <YearCalendar days={days} today={midnight} selected={view.day} onDay={selectDay} />
        <DayCard days={days} day={view.day} today={midnight} log={log} showLang={!single} onDay={selectDay} />
        <div className="grid gap-4 md:grid-cols-2">
          <ModulesCard answers={inPeriod} log={log} periodLabel={periodName} />
          <WhenCard answers={inPeriod} log={log} periodLabel={periodName} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <WordsCard answers={answers} log={log} now={now} />
          <RecordsCard records={records} onChange={setView} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{s.courses}</h2>
        <div className={cn('grid gap-4', langs.length > 1 && 'md:grid-cols-2')}>
          {langs.map((x) => (
            <LanguageCourse key={x} lang={x} current={x === current} />
          ))}
        </div>
      </section>

      <section className={cn('grid gap-4', langs.length > 1 && 'lg:grid-cols-2')}>
        {langs.map((x) => (
          <MedalShelf key={x} lang={x} showLanguage={langs.length > 1} />
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{s.forecast}</CardTitle>
          <CardDescription>{s.forecastHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {comingTotal === 0 ? (
            <p className="text-sm text-muted-foreground">{s.dueNow(0)}</p>
          ) : (
            <ColumnChart
              data={coming.map((d) => ({ key: d.day, date: d.date, value: d.count }))}
              label={s.forecast}
              barLabel={s.forecastBar}
              highlight={today}
              tone="bg-mod-recall"
            />
          )}
        </CardContent>
      </Card>

      {single && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{s.units}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {perUnit.map((p) => (
              <UnitRow key={p.unit.id} p={p} />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{s.hardest}</h2>
          <p className="text-sm text-muted-foreground">{s.hardestHint}</p>
        </div>
        {hardest.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{s.hardestNone}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {hardest.map(({ concept, lang, lapses }) => {
              const form = concept[lang]?.primary
              return (
                <li key={`${lang}:${concept.id}`}>
                  <Link
                    to={`/words/${concept.id}`}
                    className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition hover:bg-muted/60"
                  >
                    <span className="text-2xl" aria-hidden>{concept.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">{form?.latin}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {!single && <span className="font-medium text-foreground/70">{c.languagesShort[lang]} · </span>}
                        {l(concept.gloss)}
                      </span>
                    </span>
                    {form && (
                      <span lang={lang} dir="rtl" className="font-script text-lg text-muted-foreground">{form.script}</span>
                    )}
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      {s.lapses(lapses)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
