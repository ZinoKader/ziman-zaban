import { AlertTriangle, Check, ChevronDown, Circle, ClipboardCopy, Loader2, Mic, MicOff, Play, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { TargetLang } from '@/content/types'
import { cn } from '@/lib/utils'
import { diagnosticsReport, levelVerdict, readEnvironment, type Environment, type LevelVerdict } from './diagnostics'
import { unlockAudio, type MicError } from './mic'
import { studioStrings } from './strings'
import { useTakeRecorder, type RecorderDiagnostics, type Take } from './use-take-recorder'
import { encodeWav, peakDb } from './wav'

const TEST_WORD: Record<TargetLang, { text: string; latin: string }> = {
  ckb: { text: 'سڵاو', latin: 'slaw' },
  fa: { text: 'سلام', latin: 'salâm' },
}
const NO_VOICE_MS = 8000

type StepState = 'pending' | 'active' | 'ok' | 'warn' | 'fail'

function StepIcon({ state }: { state: StepState }) {
  if (state === 'ok') return <Check className="size-4 text-success" aria-hidden />
  if (state === 'warn') return <AlertTriangle className="size-4 text-warning" aria-hidden />
  if (state === 'fail') return <X className="size-4 text-destructive" aria-hidden />
  if (state === 'active') return <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
  return <Circle className="size-4 text-muted-foreground/50" aria-hidden />
}

/** What went wrong, what to do about it, and details to send to someone who can help. */
export function MicTrouble({
  error,
  env,
  diag,
  onRetry,
}: {
  error: MicError
  env: Environment
  diag: RecorderDiagnostics
  onRetry: () => void
}) {
  const s = studioStrings.use()
  const [copied, setCopied] = useState(false)
  const report = useMemo(() => diagnosticsReport(env, diag, { error }), [env, diag, error])
  const copy = () => {
    void navigator.clipboard
      ?.writeText(report)
      .then(() => setCopied(true))
      .catch(() => {})
  }
  return (
    <div className="w-full max-w-md space-y-4 text-start">
      <div className="flex items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive">
        <MicOff className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="font-medium">{s.micErrors[error]}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{s.check.howToFix}</p>
        <ol className="list-decimal space-y-1.5 ps-5 text-sm">
          {s.fixes(error, env.platform, env.inApp).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ol>
      </div>
      <Button
        size="lg"
        className="w-full"
        onClick={() => {
          unlockAudio()
          onRetry()
        }}
      >
        <RotateCcw /> {s.tryAgain}
      </Button>
      <details className="group rounded-2xl border px-4 py-3 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
          {s.check.details}
          <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">{s.check.detailsHint}</p>
        <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-muted p-2 text-[0.7rem] whitespace-pre-wrap select-all" dir="ltr">
          {report}
        </pre>
        <Button variant="outline" size="sm" className="mt-2" onClick={copy}>
          {copied ? <Check /> : <ClipboardCopy />} {copied ? s.check.copied : s.check.copy}
        </Button>
      </details>
    </div>
  )
}

interface TestTake {
  peakDb: number
  verdict: LevelVerdict
  url: string
}

/** Full-screen check: opens the microphone, waits for one spoken word and plays it back. */
export function MicCheck({ lang, onReady, onClose }: { lang: TargetLang; onReady: () => void; onClose: () => void }) {
  const s = studioStrings.use()
  const env = useMemo(() => readEnvironment(), [])
  const word = TEST_WORD[lang]
  const [started, setStarted] = useState(false)
  const [take, setTake] = useState<TestTake | null>(null)
  const [noVoice, setNoVoice] = useState(false)
  const floorRef = useRef(-100)
  const player = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const stopRef = useRef<() => void>(() => {})

  const onTake = useCallback((t: Take) => {
    const peak = peakDb(t.samples)
    const url = URL.createObjectURL(new Blob([encodeWav(t.samples, t.sampleRate)], { type: 'audio/wav' }))
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = url
    setTake({ peakDb: peak, verdict: levelVerdict(peak, floorRef.current), url })
    // iOS plays through the earpiece while the microphone is open, so close it before playback.
    stopRef.current()
  }, [])

  const rec = useTakeRecorder(word.text, onTake)
  const { start, stop, status, error, diag } = rec
  useEffect(() => {
    stopRef.current = stop
  }, [stop])
  useEffect(() => {
    floorRef.current = diag.floorDb
  }, [diag.floorDb])

  const begin = () => {
    unlockAudio()
    player.current?.pause()
    setTake(null)
    setNoVoice(false)
    setStarted(true)
    void start()
  }

  const listening = status === 'listening' || status === 'hearing'
  useEffect(() => {
    if (!listening) return
    const t = setTimeout(() => setNoVoice(true), NO_VOICE_MS)
    return () => clearTimeout(t)
  }, [listening])

  useEffect(
    () => () => {
      player.current?.pause()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const play = () => {
    if (!take) return
    player.current ??= new Audio()
    player.current.src = take.url
    void player.current.play().catch(() => {})
  }

  const browserOk = env.getUserMedia && env.audioContext && env.secure
  const browserFail = error === 'unsupported' || error === 'insecure'
  const allowFail = error === 'denied' || error === 'busy' || error === 'nodevice' || (error === 'failed' && !diag.info)
  const soundFail = error === 'blocked' || error === 'silent' || (error === 'failed' && !!diag.info)
  const opened = !!diag.info || !!take
  const steps: Array<{ key: keyof typeof s.check.steps; state: StepState; note?: string }> = [
    { key: 'browser', state: browserFail || !browserOk ? 'fail' : env.inApp ? 'warn' : 'ok', note: env.inApp ? s.check.inAppWarning(env.inApp) : undefined },
    { key: 'allowed', state: allowFail ? 'fail' : opened ? 'ok' : started && !error ? 'active' : 'pending' },
    { key: 'sound', state: soundFail ? 'fail' : diag.chunks > 0 || take ? 'ok' : opened && !error ? 'active' : 'pending' },
    {
      key: 'voice',
      state: take ? 'ok' : error ? 'pending' : listening && noVoice ? 'warn' : diag.chunks > 0 ? 'active' : 'pending',
      note: !take && listening && noVoice ? [s.check.noVoice, env.platform === 'ios' ? s.check.noVoiceIos : ''].filter(Boolean).join(' ') : undefined,
    },
    { key: 'level', state: take ? (take.verdict === 'good' ? 'ok' : 'warn') : 'pending', note: take ? s.check.verdict[take.verdict] : undefined },
  ]

  return (
    <div role="dialog" aria-modal="true" aria-label={s.check.title} className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold">{s.check.title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X /> {s.check.close}
        </Button>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 overflow-y-auto px-4 py-6 text-center">
        {!started ? (
          <div className="my-auto space-y-5">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <Mic className="size-8" />
            </span>
            <p className="text-pretty text-muted-foreground">{s.check.intro}</p>
            <Button size="xl" onClick={begin}>
              <Mic /> {s.check.start}
            </Button>
          </div>
        ) : (
          <>
            {!error && !take && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{s.check.sayThis}</p>
                <p dir="rtl" lang={lang} className="font-script text-5xl leading-[1.6]">
                  {word.text}
                </p>
                <p dir="ltr" className="text-muted-foreground">
                  {word.latin}
                </p>
                <div className="relative mx-auto grid size-20 place-items-center">
                  <span
                    className={cn('absolute inset-0 rounded-full transition-transform duration-75', status === 'hearing' ? 'bg-primary/25' : 'bg-primary/10')}
                    style={{ transform: `scale(${listening ? 0.7 + rec.level * 0.6 : 0.7})` }}
                    aria-hidden
                  />
                  <span className="relative grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Mic className="size-6" />
                  </span>
                </div>
                <p className="min-h-5 text-sm font-medium" aria-live="polite">
                  {status === 'hearing' ? s.status.hearing : listening ? s.check.waiting : s.status[status]}
                </p>
              </div>
            )}

            <ol className="w-full space-y-1 rounded-2xl border p-2 text-start" aria-label={s.check.title}>
              {steps.map((st) => (
                <li key={st.key} className="flex gap-3 rounded-xl px-2 py-2">
                  <span className="mt-0.5">
                    <StepIcon state={st.state} />
                  </span>
                  <span className="space-y-0.5">
                    <span className={cn('block text-sm font-medium', st.state === 'pending' && 'text-muted-foreground')}>{s.check.steps[st.key]}</span>
                    {st.note && <span className="block text-xs text-muted-foreground">{st.note}</span>}
                  </span>
                </li>
              ))}
            </ol>

            {error && <MicTrouble error={error} env={env} diag={diag} onRetry={begin} />}

            {take && (
              <div className="w-full space-y-3">
                <p className={cn('font-medium', take.verdict === 'good' ? 'text-success' : 'text-warning')}>
                  {take.verdict === 'good' ? s.check.passed : s.check.verdict[take.verdict]}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="lg" onClick={play}>
                    <Play /> {s.check.listen}
                  </Button>
                  <Button variant="outline" size="lg" onClick={begin}>
                    <RotateCcw /> {s.check.again}
                  </Button>
                </div>
                <Button
                  size="xl"
                  className="w-full"
                  onClick={() => {
                    unlockAudio()
                    onReady()
                  }}
                >
                  <Mic /> {s.check.ready}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
