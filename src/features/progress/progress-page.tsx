import { ArrowRight, CircleCheck, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { formatWhen, periodLabel } from './format'
import { Highlights, ModulesCard, RecordsCard, WhenCard, WordsCard } from './insights'
import { addDaysTo, answersBetween, answersOf, parseDay, recordsOf, reviewRecall } from './stats-data'
import { useStatsView } from './stats-params'
import { YearCalendar } from './year-calendar'
import { MemoryCard, ForecastCard } from './memory-card'
import { Meter } from './meter'
import { CourseSummary, ModuleBars } from './progress-card'
import {
  courseProgress,
  dueNow,
  forecast,
  hardestWords,
  memoryOf,
  moduleProgress,
  startedLanguages,
  unitProgress,
  type UnitProgress,
} from './progress-data'
import { progressStrings } from './strings'
import { ContentIcon } from '@/components/content-icon'

const SCRIPT_NAME: Record<TargetLang, string> = { ckb: 'کوردی', fa: 'فارسی' }

function LanguageCourse({ lang, current, badge }: { lang: TargetLang; current: boolean; badge: boolean }) {
  const s = progressStrings.use()
  const c = common.use()
  const set = useSettings((st) => st.set)
  const cards = useProgress((st) => st.cards)
  const course = useMemo(() => courseProgress(lang, cards), [lang, cards])
  const now = useNow()
  const modules = useMemo(() => moduleProgress(lang, cards, now), [lang, cards, now])
  return (
    <Card className={cn(badge && current && 'ring-2 ring-primary/30')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span lang={lang} dir="rtl" className="font-script text-2xl text-primary">{SCRIPT_NAME[lang]}</span>
          <span>{c.languages[lang]}</span>
          {badge && current && <span className="ms-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{s.current}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="@container space-y-5">
        <CourseSummary course={course} size="md" />
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

function UnitRow({ p }: { p: UnitProgress }) {
  const s = progressStrings.use()
  const l = useLocalize()
  const { unit, words, sentences, questions, state } = p
  const count = s.unitWords(words.learned, words.total, words.learning)
  return (
    <li className={cn('flex items-start gap-3 rounded-2xl border bg-card p-4', state === 'upcoming' && 'bg-card/60')}>
      <ContentIcon name={unit.icon} strokeWidth={1.75} className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
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

const UNITS_SHOWN = 4

function Units({ units }: { units: UnitProgress[] }) {
  const s = progressStrings.use()
  const [all, setAll] = useState(false)
  const open = units.findIndex((p) => p.state !== 'done')
  const from = Math.max(0, Math.min((open < 0 ? units.length : open) - 1, units.length - UNITS_SHOWN))
  const shown = all ? units : units.slice(from, from + UNITS_SHOWN)
  return (
    <div className="space-y-3 pt-2">
      <h3 className="font-semibold">{s.units}</h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((p) => (
          <UnitRow key={p.unit.id} p={p} />
        ))}
      </ul>
      {shown.length < units.length || all ? (
        <Button variant="outline" size="sm" onClick={() => setAll(!all)}>
          {all ? s.fewerUnits : s.allUnits(units.length)}
        </Button>
      ) : null}
    </div>
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
  const memory = useMemo(() => memoryOf(cards, langs, now), [cards, langs, now])

  const midnight = useMemo(() => parseDay(today), [today])
  const [view, setView] = useStatsView(now)
  const reviewLog = useReviewLog()
  const answers = useMemo(() => reviewLog.data && answersOf(reviewLog.data, langs), [reviewLog.data, langs])
  const log: LogState = { answers, failed: reviewLog.isError && !answers, retry: () => void reviewLog.refetch() }
  const inPeriod = useMemo(() => answers && answersBetween(answers, view.period.start, view.period.end), [answers, view.period.start, view.period.end])
  const recall = useMemo(() => answers && reviewRecall(answers, addDaysTo(midnight, -29)), [answers, midnight])
  const records = useMemo(() => recordsOf(days), [days])
  const periodName = periodLabel(view.range, view.period.start, view.period.end, baseLang)
  const selectDay = (day: string) => setView({ day })

  return (
    <div className="space-y-8">
      <Highlights streakNow={streak(days, now)} records={records} todayStats={days[today]} due={due} tomorrow={coming[1]?.count ?? 0} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{s.courses}</h2>
        <div className={cn('grid gap-4', langs.length > 1 && 'md:grid-cols-2')}>
          {langs.map((x) => (
            <LanguageCourse key={x} lang={x} current={x === current} badge={langs.length > 1} />
          ))}
        </div>
        {single && <Units units={perUnit} />}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <MemoryCard memory={memory} recall={recall} log={log} />
        <ForecastCard days={coming} />
      </div>

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
                    <span className="grid size-8 shrink-0 place-items-center text-muted-foreground">
                      {concept.icon && <ContentIcon name={concept.icon} strokeWidth={1.75} className="size-6" />}
                    </span>
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{s.history}</h2>
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

      <section className={cn('grid gap-4', langs.length > 1 && 'lg:grid-cols-2')}>
        {langs.map((x) => (
          <MedalShelf key={x} lang={x} showLanguage={langs.length > 1} />
        ))}
      </section>
    </div>
  )
}
