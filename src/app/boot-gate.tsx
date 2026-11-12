import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { queryClient } from '@/data/query-client'
import { progressStrings } from '@/features/progress/strings'
import { boot } from './boot'

function guessBaseLang() {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('sv') ? 'sv' : 'en'
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 grid place-items-center bg-background px-6 opacity-0 [animation:pop-in_300ms_ease-out_250ms_forwards] motion-reduce:[animation:none] motion-reduce:opacity-100"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span
          aria-hidden
          className="grid size-16 place-items-center rounded-2xl bg-primary font-script text-3xl text-primary-foreground shadow-lg motion-safe:animate-pulse"
        >
          ز
        </span>
        {children}
      </div>
    </div>
  )
}

export function Splash() {
  const s = progressStrings.get(guessBaseLang())
  return (
    <Screen>
      <p className="text-sm text-muted-foreground">{s.loading}</p>
    </Screen>
  )
}

function BootFailed({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const s = progressStrings.get(guessBaseLang())
  return (
    <Screen>
      <p className="text-sm text-muted-foreground">{s.loadFailed}</p>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        <RotateCcw /> {s.retry}
      </Button>
    </Screen>
  )
}

export function BootGate({ children, start = boot }: { children: React.ReactNode; start?: () => Promise<true> }) {
  const booted = useQuery({ queryKey: ['boot'], queryFn: start, staleTime: Infinity, retry: 1 }, queryClient)
  if (booted.isPending) return <Splash />
  if (booted.isError) return <BootFailed onRetry={() => void booted.refetch()} retrying={booted.isFetching} />
  return <Suspense fallback={<Splash />}>{children}</Suspense>
}
