import { useEffect, useState } from 'react'
import { progressStrings } from '@/features/progress/strings'
import { useHydrated } from '@/store/hydration'

/** If reading the device database stalls entirely, show the app rather than a spinner forever. */
const GIVE_UP_MS = 8000

function guessBaseLang() {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('sv') ? 'sv' : 'en'
}

function Splash() {
  const s = progressStrings.get(guessBaseLang())
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 grid place-items-center bg-background opacity-0 [animation:pop-in_300ms_ease-out_250ms_forwards] motion-reduce:[animation:none] motion-reduce:opacity-100"
    >
      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden
          className="grid size-16 place-items-center rounded-2xl bg-primary font-script text-3xl text-primary-foreground shadow-lg motion-safe:animate-pulse"
        >
          ز
        </span>
        <p className="text-sm text-muted-foreground">{s.loading}</p>
      </div>
    </div>
  )
}

/**
 * Progress and settings live in IndexedDB, which loads asynchronously.
 * Rendering before that would flash onboarding at returning learners and show empty progress.
 */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated()
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    if (hydrated) return
    const t = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(t)
  }, [hydrated])
  return hydrated || gaveUp ? children : <Splash />
}
