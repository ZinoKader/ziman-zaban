import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DisclosureProps {
  label: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

/** A quiet "more about this" line that opens secondary information in place. */
export function Disclosure({ label, children, defaultOpen = false, className }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        {label}
        <ChevronDown className={cn('size-4 shrink-0 motion-safe:transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={id} className="animate-pop-in space-y-4 pb-1 pt-3 text-foreground">
          {children}
        </div>
      )}
    </div>
  )
}
