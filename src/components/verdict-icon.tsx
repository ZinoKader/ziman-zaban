import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type Verdict = 'right' | 'close' | 'wrong'

const EASE = [0.16, 1, 0.3, 1] as const

const MARKS: Record<Verdict, string[]> = {
  right: ['M7.75 12.5l2.75 2.75 5.75-6'],
  close: ['M12 7.5v5.25', 'M12 16.25h.01'],
  wrong: ['M15 9l-6 6', 'M9 9l6 6'],
}

/** A ring that draws itself, then the check, cross or exclamation mark inside it. */
export function VerdictIcon({ verdict, className }: { verdict: Verdict; className?: string }) {
  const still = useReducedMotion()
  const draw = (delay: number, duration: number) =>
    still
      ? { initial: false as const }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { pathLength: { delay, duration, ease: EASE }, opacity: { delay, duration: 0.01 } },
        }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('size-6 shrink-0', className)}
    >
      <motion.circle cx="12" cy="12" r="10" {...draw(0, 0.45)} />
      {MARKS[verdict].map((d, i) => (
        <motion.path key={d} d={d} {...draw(0.28 + i * 0.1, verdict === 'right' ? 0.32 : 0.22)} />
      ))}
    </svg>
  )
}
