import { useEffect, useMemo, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import type { TargetLang } from '@/content/types'
import { seededRandom } from '@/lib/distractors'
import { useSettings } from '@/store/settings'
import { Medal } from './medal'
import { tierOf } from './medals'
import { medalStrings } from './strings'

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#facc15', '#14b8a6']

function playFanfare() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  try {
    const ctx = new Ctx()
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t = ctx.currentTime + i * 0.13
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.16, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + (i === 3 ? 1.2 : 0.5))
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 1.3)
    })
    setTimeout(() => void ctx.close(), 2000)
  } catch {
    // Sound is a bonus; the celebration works without it.
  }
}

function Confetti() {
  const pieces = useMemo(() => {
    const r = seededRandom('confetti')
    return Array.from({ length: 80 }, (_, i) => ({
      left: `${r() * 100}%`,
      color: COLORS[i % COLORS.length],
      size: 6 + r() * 8,
      round: r() < 0.3,
      style: {
        '--delay': `${r() * 1.2}s`,
        '--fall': `${2.4 + r() * 2.2}s`,
        '--drift': `${(r() - 0.5) * 160}px`,
        '--spin': `${(r() < 0.5 ? -1 : 1) * (360 + r() * 720)}deg`,
      } as CSSProperties,
    }))
  }, [])
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-0 block"
          style={{ ...p.style, left: p.left, width: p.size, height: p.round ? p.size : p.size * 0.45, background: p.color, borderRadius: p.round ? '9999px' : '2px' }}
        />
      ))}
    </div>
  )
}

interface CelebrationProps {
  lang: TargetLang
  /** The milestone to show: the highest one just reached. */
  words: number
  total: number
  /** Lower milestones awarded at the same time. */
  alsoEarned: number
  onClose: () => void
}

export function Celebration({ lang, words, total, alsoEarned, onClose }: CelebrationProps) {
  const s = medalStrings.use()
  const tier = tierOf(words, total)

  useEffect(() => {
    if (useSettings.getState().autoplayAudio) playFanfare()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      aria-describedby="celebration-text"
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
    >
      <Confetti />
      <div className="animate-pop-in relative flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl bg-card px-6 pb-6 pt-8 text-center shadow-2xl">
        <div className="relative">
          <div className="animate-medal-shine absolute inset-[-20%] rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.55),transparent_65%)]" aria-hidden />
          <div className="animate-medal-in">
            <div className="animate-medal-sway">
              <Medal words={words} tier={tier} wordsLabel={s.words} size="lg" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <h2 id="celebration-title" className="text-3xl font-bold">
            {s.hooray}
          </h2>
          <div id="celebration-text" className="space-y-1">
            <p className="text-lg font-semibold">{words >= total ? s.learnedAll[lang](total) : s.learned[lang](words)}</p>
            <p className="text-muted-foreground">{s.earned[tier]}</p>
            {alsoEarned > 0 && <p className="text-sm text-muted-foreground">{s.also(alsoEarned)}</p>}
          </div>
        </div>
        <Button size="xl" className="w-full" onClick={onClose} autoFocus>
          {s.thanks}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
