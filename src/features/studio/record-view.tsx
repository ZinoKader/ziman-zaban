import { Check, ChevronLeft, Mic, Pause, Play, SkipForward, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { cn } from '@/lib/utils'
import { levelVerdict, readEnvironment } from './diagnostics'
import { MicTrouble } from './mic-check'
import type { Prompt } from './prompts'
import { back, countRecorded, recorded, skipped, startRun, type RunState } from './run'
import { takeKey, useStudio } from './store'
import { studioStrings } from './strings'
import { useTakeRecorder, type Take } from './use-take-recorder'
import { encodeWav, normalized, peakDb } from './wav'

function ScriptLine({ lang, text, className }: { lang: TargetLang; text: string; className?: string }) {
  return (
    <p dir="rtl" lang={lang} className={cn('font-script text-balance leading-[1.6]', className)}>
      {text}
    </p>
  )
}

/** Full-screen teleprompter: shows one prompt at a time and moves on whenever a take ends. */
export function RecordView({ lang, prompts, onClose }: { lang: TargetLang; prompts: Prompt[]; onClose: () => void }) {
  const s = studioStrings.use()
  const l = useLocalize()
  const addTake = useStudio((st) => st.addTake)
  const removeTakes = useStudio((st) => st.removeTakes)
  const [run, setRun] = useState<RunState>(startRun)
  const [flash, setFlash] = useState<'saved' | 'quiet' | 'loud' | null>(null)
  const runRef = useRef(run)
  const current = prompts[run.index] as Prompt | undefined
  const finished = run.index >= prompts.length

  const onTake = useCallback(
    (take: Take) => {
      const r = runRef.current
      const prompt = prompts[r.index]
      if (!prompt) return
      const peak = peakDb(take.samples)
      void addTake(
        {
          lang,
          text: prompt.text,
          latin: prompt.latin,
          kind: prompt.kind,
          recordedAt: new Date().toISOString(),
          durationMs: Math.round((take.samples.length / take.sampleRate) * 1000),
          peakDb: Math.round(peak * 10) / 10,
        },
        encodeWav(normalized(take.samples), take.sampleRate),
      )
      const next = recorded(r)
      runRef.current = next
      setRun(next)
      const verdict = levelVerdict(peak, take.floorDb)
      setFlash(verdict === 'quiet' || verdict === 'loud' ? verdict : 'saved')
    },
    [addTake, lang, prompts],
  )

  const env = useMemo(() => readEnvironment(), [])
  const rec = useTakeRecorder(current?.text, onTake)
  const { start, stop, setPaused, cancel } = rec

  useEffect(() => {
    void start()
    return stop
  }, [start, stop])

  useEffect(() => {
    if (finished) stop()
  }, [finished, stop])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), flash === 'saved' ? 700 : 2500)
    return () => clearTimeout(t)
  }, [flash, run.index])

  const goBack = useCallback(() => {
    const step = back(runRef.current)
    if (step.undo !== null) void removeTakes([takeKey(lang, prompts[step.undo].text)])
    cancel()
    runRef.current = step.state
    setRun(step.state)
    setFlash(null)
  }, [cancel, lang, prompts, removeTakes])

  const skip = useCallback(() => {
    cancel()
    const next = skipped(runRef.current)
    runRef.current = next
    setRun(next)
  }, [cancel])

  const paused = rec.status === 'paused'
  const togglePause = useCallback(() => setPaused(!paused), [paused, setPaused])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (e.key === 'Escape') return onClose()
      if (finished) return
      if (e.key === 'Backspace') {
        e.preventDefault()
        goBack()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        skip()
      } else if (e.key === ' ') {
        e.preventDefault()
        togglePause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, goBack, onClose, skip, togglePause])

  const prev = run.history.at(-1)
  const prevPrompt = prev ? prompts[prev.index] : undefined
  const listening = rec.status === 'listening' || rec.status === 'hearing'

  return (
    <div role="dialog" aria-modal="true" aria-label={s.title} className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {s.position(Math.min(run.index + 1, prompts.length), prompts.length)}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(run.index / Math.max(1, prompts.length)) * 100}%` }} />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X /> {s.done}
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
        {finished ? (
          <div className="space-y-4">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <Check className="size-8" />
            </span>
            <p className="text-2xl font-semibold">{s.finished}</p>
            <p className="text-muted-foreground">{s.recordedNow(countRecorded(run))}</p>
            <Button size="xl" onClick={onClose}>
              {s.done}
            </Button>
          </div>
        ) : rec.status === 'error' ? (
          <MicTrouble error={rec.error ?? 'failed'} env={env} diag={rec.diag} onRetry={() => void start()} />
        ) : (
          current && (
            <>
              <div className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                {prevPrompt && (
                  <>
                    {prev!.recorded ? <Check className="size-4 text-primary" /> : <SkipForward className="size-4" />}
                    <ScriptLine lang={lang} text={prevPrompt.text} className="text-lg opacity-70" />
                  </>
                )}
              </div>

              <div key={run.index} className="animate-in fade-in slide-in-from-bottom-2 space-y-3 duration-200">
                <ScriptLine lang={lang} text={current.text} className={cn('font-medium', current.text.length > 40 ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-7xl')} />
                <p dir="ltr" lang={`${lang}-Latn`} className="text-lg text-muted-foreground">
                  {current.latin}
                </p>
                {current.meaning && (
                  <p className="text-sm text-muted-foreground">{current.answers ? s.answerTo(l(current.meaning)) : l(current.meaning)}</p>
                )}
              </div>

              <div className="relative mt-2 grid size-24 place-items-center">
                <span
                  className={cn('absolute inset-0 rounded-full transition-transform duration-75', rec.status === 'hearing' ? 'bg-primary/25' : 'bg-primary/10')}
                  style={{ transform: `scale(${listening ? 0.7 + rec.level * 0.6 : 0.7})` }}
                  aria-hidden
                />
                <span className={cn('relative grid size-14 place-items-center rounded-full', paused ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground')}>
                  {flash === 'saved' ? <Check className="size-7" /> : <Mic className="size-7" />}
                </span>
              </div>
              <p className="min-h-6 text-sm font-medium" aria-live="polite">
                {flash === 'saved' ? s.saved : flash ? <span className="text-amber-600 dark:text-amber-400">{s[flash]}</span> : s.status[rec.status]}
              </p>
              {rec.noisy && listening && <p className="max-w-sm text-xs text-amber-600 dark:text-amber-400">{s.noisy}</p>}

              {prompts[run.index + 1] && (
                <div className="space-y-1 opacity-50">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.upNext}</p>
                  {prompts.slice(run.index + 1, run.index + 3).map((p) => (
                    <ScriptLine key={p.text} lang={lang} text={p.text} className="text-xl" />
                  ))}
                </div>
              )}
            </>
          )
        )}
      </main>

      {!finished && rec.status !== 'error' && (
        <footer className="border-t px-4 py-3">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
            <Button variant="outline" size="lg" onClick={goBack} disabled={!run.history.length}>
              <ChevronLeft className="rtl:rotate-180" /> {s.back}
            </Button>
            <Button variant="outline" size="lg" onClick={togglePause} disabled={!listening && !paused}>
              {paused ? <Play /> : <Pause />} {paused ? s.resume : s.pause}
            </Button>
            <Button variant="outline" size="lg" onClick={skip}>
              {s.skip} <SkipForward />
            </Button>
          </div>
          <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">{s.keys}</p>
        </footer>
      )}
    </div>
  )
}
