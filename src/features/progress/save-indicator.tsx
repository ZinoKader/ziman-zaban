import { CircleCheck, Database, ShieldCheck, ShieldQuestion, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { useSaveStatus } from '@/store/save-status'
import { useSettings } from '@/store/settings'
import { formatWhen } from './format'
import { progressStrings } from './strings'

/** Brief highlight after each save; first render (hydration) does not count. */
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
  const { medium, persistent, persistSupported, lastSavedAt, failed } = useSaveStatus()
  const now = useNow()
  const protection = !persistSupported || persistent === null ? 'unknown' : persistent ? 'granted' : 'denied'
  const ProtectionIcon = protection === 'granted' ? ShieldCheck : ShieldQuestion
  return (
    <ul className="space-y-2 text-sm">
      <li className="flex gap-2">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <span>{lastSavedAt ? s.lastSaved(formatWhen(lastSavedAt, baseLang, s.justNow, now)) : s.neverSaved}</span>
      </li>
      <li className="flex gap-2">
        <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>{s.medium[medium]}</span>
      </li>
      {medium !== 'memory' && (
        <li className="flex gap-2">
          <ProtectionIcon className={cn('mt-0.5 size-4 shrink-0', protection === 'granted' ? 'text-success' : 'text-muted-foreground')} />
          <span>{s.protection[protection]}</span>
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
  const { saves, failed, medium } = useSaveStatus()
  const flash = useJustSaved(saves)
  const [open, setOpen] = useState(false)
  const warn = failed || medium === 'memory'
  const Icon = warn ? TriangleAlert : CircleCheck
  const label = warn ? s.notSaved : s.saved

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
            warn ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            flash && !warn && 'bg-success/12 text-success',
            className,
          )}
        >
          <Icon key={saves} className={cn('size-4 shrink-0', !warn && 'text-success', flash && 'animate-pop-in')} />
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
