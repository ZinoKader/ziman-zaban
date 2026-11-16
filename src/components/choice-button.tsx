import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { VerdictIcon } from './verdict-icon'

export type ChoiceState = 'idle' | 'right' | 'wrong' | 'dim'

interface ChoiceButtonProps {
  state: ChoiceState
  /** Shown as the keyboard shortcut (1-based) on wider screens. */
  index: number
  onChoose: () => void
  disabled?: boolean
  /** Hover border colour while idle. */
  accent?: string
  /** Stacks the content centred, with the shortcut in the corner. */
  stacked?: boolean
  className?: string
  children: ReactNode
}

/** One option in a multiple-choice question. After answering, its colour spreads out from where it was tapped. */
export function ChoiceButton({ state, index, onChoose, disabled, accent = 'hover:border-primary/60', stacked, className, children }: ChoiceButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const tapped = useRef(false)
  const verdict = state === 'right' || state === 'wrong'

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const box = el.getBoundingClientRect()
    el.style.setProperty('--fx', `${e.clientX - box.left}px`)
    el.style.setProperty('--fy', `${e.clientY - box.top}px`)
  }

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onClick={() => {
        tapped.current = true
        onChoose()
      }}
      className={cn(
        'group relative isolate flex min-h-16 animate-rise-in overflow-hidden rounded-2xl border-2 bg-card shadow-xs transition-[border-color,box-shadow,opacity,translate,scale] duration-200 ease-out-quart',
        stacked ? 'flex-col items-center justify-center px-3 py-2' : 'items-center gap-3 px-4 py-3 text-start',
        state === 'idle' && cn('hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.985] motion-reduce:hover:translate-y-0', accent),
        state === 'right' && 'border-success',
        state === 'wrong' && 'animate-shake border-destructive',
        state === 'dim' && 'opacity-45',
        className,
      )}
      style={state === 'idle' ? { animationDelay: `${(index - 1) * 45}ms` } : undefined}
    >
      {verdict && (
        <span
          aria-hidden
          className={cn('absolute inset-0 -z-10 animate-flood', state === 'right' ? 'bg-success/14' : 'bg-destructive/12')}
          // The right answer the learner missed fills a beat later, from its centre.
          style={tapped.current ? undefined : { animationDelay: '140ms', ['--fx' as string]: '50%', ['--fy' as string]: '50%' }}
        />
      )}
      <kbd
        className={cn(
          'hidden shrink-0 items-center justify-center border bg-muted text-muted-foreground sm:flex',
          stacked ? 'absolute start-2 top-2 size-5 rounded text-[0.65rem]' : 'size-6 rounded-md text-xs',
        )}
      >
        {index}
      </kbd>
      {children}
      {verdict && (
        <VerdictIcon
          verdict={state}
          className={cn(state === 'right' ? 'text-success' : 'text-destructive', stacked && 'absolute end-2 top-2 size-5')}
        />
      )}
    </button>
  )
}
