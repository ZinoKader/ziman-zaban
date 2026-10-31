import { ArrowRight, CircleCheck, Flame, Lock } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { dayKey, streak, useProgress } from '@/store/progress'
import { useSaveStatus } from '@/store/save-status'
import { useSettings } from '@/store/settings'
import { formatWhen, shortDate, weekday } from './format'
import { Meter } from './meter'
import { CourseSummary, ModuleBars } from './progress-card'
import {
  accuracy,
  activity,
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
      <CardContent className="space-y-5">
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

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
        {icon}
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
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

export function ProgressPage() {
  const s = progressStrings.use()
  const l = useLocalize()
  const lang = useSettings((st) => st.targetLang)
  const baseLang = useSettings((st) => st.baseLang)
  const cards = useProgress((st) => st.cards)
  const days = useProgress((st) => st.days)
  const lastSavedAt = useSaveStatus((st) => st.lastSavedAt)

  const now = useNow()
  const today = dayKey(now)
  const langs = useMemo(() => {
    const started = startedLanguages(cards)
    return [lang, ...started.filter((x) => x !== lang)]
  }, [cards, lang])
  const recent = useMemo(() => activity(days, now, 14), [days, now])
  const acc = useMemo(() => accuracy(days, now, 7), [days, now])
  const coming = useMemo(() => forecast(cards, lang, now, 7), [cards, lang, now])
  const perUnit = useMemo(() => unitProgress(lang, cards), [cards, lang])
  const hardest = useMemo(() => hardestWords(cards, lang, 8), [cards, lang])
  const due = useMemo(() => dueNow(lang, cards, now), [cards, lang, now])
  const daysPractised = Object.values(days).filter((d) => d.reviews > 0).length
  const recentTotal = recent.reduce((n, d) => n + d.reviews, 0)
  const comingTotal = coming.reduce((n, d) => n + d.count, 0)

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

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={s.stats.streak} value={streak(days, now)} icon={<Flame className="size-5 text-orange-500" />} />
        <Stat label={s.stats.today} value={days[today]?.reviews ?? 0} />
        <Stat label={s.stats.due} value={due} />
        <Stat label={s.stats.days} value={daysPractised} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{s.courses}</h2>
        <div className={cn('grid gap-4', langs.length > 1 && 'md:grid-cols-2')}>
          {langs.map((x) => (
            <LanguageCourse key={x} lang={x} current={x === lang} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>{s.activity}</CardTitle>
            <CardDescription>{s.activityTotal(recentTotal)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnChart
              data={recent.map((d) => ({ key: d.day, date: d.date, value: d.reviews }))}
              label={s.activity}
              barLabel={s.activityBar}
              highlight={today}
              tone="bg-primary"
            />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{s.accuracy}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {acc.pct === null ? (
              <p className="text-sm text-muted-foreground">{s.accuracyNone}</p>
            ) : (
              <>
                <p className="text-4xl font-semibold tabular-nums">{acc.pct}%</p>
                <Meter learned={acc.correct} total={acc.reviews} tone="success" size="sm" label={s.accuracyDetail(acc.correct, acc.reviews)} />
                <p className="text-sm text-muted-foreground">{s.accuracyDetail(acc.correct, acc.reviews)}</p>
              </>
            )}
          </CardContent>
        </Card>
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{s.units}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {perUnit.map((p) => (
            <UnitRow key={p.unit.id} p={p} />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{s.hardest}</h2>
          <p className="text-sm text-muted-foreground">{s.hardestHint}</p>
        </div>
        {hardest.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{s.hardestNone}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {hardest.map(({ concept, lapses }) => {
              const form = concept[lang]?.primary
              return (
                <li key={concept.id}>
                  <Link
                    to={`/words/${concept.id}`}
                    className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition hover:bg-muted/60"
                  >
                    <span className="text-2xl" aria-hidden>{concept.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">{form?.latin}</span>
                      <span className="block truncate text-sm text-muted-foreground">{l(concept.gloss)}</span>
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
