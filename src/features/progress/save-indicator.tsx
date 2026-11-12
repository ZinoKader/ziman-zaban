import { CircleCheck, Cloud, TriangleAlert, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { useServerSaves } from '@/data/server-saves'
import { useAccount } from '@/store/account'
import { useSettings } from '@/store/settings'
import { formatWhen } from './format'
import { progressStrings } from './strings'

function useJustSaved(saves: number) {
  const [flash, setFlash] = useState(false)
  const first = useRef(saves)
  useEffect(() => {
    if (saves === first.current) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 1600)
    return () => clearTimeout(t)
  }, [saves])
  return flash
}

export function SaveDetails() {
  const s = progressStrings.use()
  const baseLang = useSettings((st) => st.baseLang)
  const account = useAccount()
  const { lastSavedAt, failed, waiting } = useServerSaves()
  const now = useNow()
  return (
    <ul className="space-y-2 text-sm">
      <li className="flex gap-2">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <span>{lastSavedAt ? s.lastSaved(formatWhen(lastSavedAt, baseLang, s.justNow, now)) : s.neverSaved}</span>
      </li>
      {account && (
        <li className="flex gap-2">
          <Cloud className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{account.guest || !account.email ? s.where.guest : s.where.account(account.email)}</span>
        </li>
      )}
      {waiting && (
        <li className="flex gap-2">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{s.offline}</span>
        </li>
      )}
      {failed && (
        <li className="flex gap-2 text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{s.failed}</span>
        </li>
      )}
    </ul>
  )
}

export function SaveIndicator({ className }: { className?: string }) {
  const s = progressStrings.use()
  const { saves, failed, waiting } = useServerSaves()
  const flash = useJustSaved(saves)
  const [open, setOpen] = useState(false)
  const ok = !failed && !waiting
  const Icon = failed ? TriangleAlert : waiting ? WifiOff : CircleCheck
  const label = failed ? s.notSaved : waiting ? s.waiting : s.saved

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          data-flash={flash || undefined}
          className={cn(
            'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap transition-colors duration-500',
            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            failed ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            flash && ok && 'bg-success/12 text-success',
            className,
          )}
        >
          <Icon key={saves} className={cn('size-4 shrink-0', ok && 'text-success', flash && 'animate-pop-in')} />
          <span className="hidden xl:inline">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="font-medium">{label}</p>
        <SaveDetails />
        <Link
          to="/settings#data"
          onClick={() => setOpen(false)}
          className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {s.manage}
        </Link>
      </PopoverContent>
    </Popover>
  )
}
