import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DisclosureProps {
  label: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

/** A quiet "more about this" line that opens secondary information in place. */
export function Disclosure({ label, children, defaultOpen = false, className }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const still = useReducedMotion()
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
        <ChevronDown className={cn('size-4 shrink-0 transition-transform duration-300 ease-out-expo', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            className="overflow-hidden"
            initial={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.36, ease: EASE }, opacity: { duration: 0.24, delay: 0.06 } } }}
            exit={{ height: still ? undefined : 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
          >
            <div className="space-y-4 pb-1 pt-3 text-foreground">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
