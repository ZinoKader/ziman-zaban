import type { TargetLang } from '@/content/types'
import { cn } from '@/lib/utils'
import { stripPunct } from './logic'

export type TileState = 'idle' | 'placed' | 'used' | 'correct' | 'misplaced' | 'wrong'

const RAISE = {
  border: 'shadow-[0_3px_0_0_var(--color-border)]',
  primary: 'shadow-[0_3px_0_0_color-mix(in_oklab,var(--color-primary)_45%,transparent)]',
  success: 'shadow-[0_3px_0_0_color-mix(in_oklab,var(--color-success)_55%,transparent)]',
  warning: 'shadow-[0_3px_0_0_color-mix(in_oklab,var(--color-warning)_70%,transparent)]',
  destructive: 'shadow-[0_3px_0_0_color-mix(in_oklab,var(--color-destructive)_55%,transparent)]',
}

const STATE: Record<TileState, string> = {
  idle: cn(
    'border-border bg-card',
    RAISE.border,
    'hover:-translate-y-0.5 hover:border-primary/50 active:translate-y-[3px] active:shadow-none',
  ),
  placed: cn(
    'border-primary/35 bg-card',
    RAISE.primary,
    'hover:-translate-y-0.5 hover:border-destructive/40 active:translate-y-[3px] active:shadow-none',
  ),
  used: 'border-dashed border-border bg-muted/60 shadow-none',
  correct: cn('border-success bg-success/10', RAISE.success),
  misplaced: cn('border-warning bg-warning/15', RAISE.warning),
  wrong: cn('border-destructive bg-destructive/10 line-through decoration-destructive/70 decoration-2', RAISE.destructive),
}

interface WordTileProps {
  lang: TargetLang
  text: string
  latin?: string
  showLatin?: boolean
  state: TileState
  /** Keyboard shortcut shown on desktop (1-9, 0 for the tenth). */
  shortcut?: number
  label?: string
  onClick?: () => void
  className?: string
}

/** A raised, pressable word tile for the word bank and the answer line. */
export function WordTile({ lang, text, latin, showLatin, state, shortcut, label, onClick, className }: WordTileProps) {
  const interactive = !!onClick && (state === 'idle' || state === 'placed')
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-label={label}
      aria-hidden={state === 'used' || undefined}
      tabIndex={state === 'used' ? -1 : undefined}
      data-state={state}
      className={cn(
        'relative inline-flex min-h-13 min-w-12 select-none flex-col items-center justify-center rounded-2xl border-2 px-3.5 pb-1.5 pt-1',
        'outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-default',
        'motion-safe:transition-[translate,box-shadow,border-color,background-color] motion-safe:duration-150',
        STATE[state],
        className,
      )}
    >
      <span className={cn('flex flex-col items-center', state === 'used' && 'invisible')}>
        <span dir="rtl" lang={lang} className="text-xl font-medium leading-snug sm:text-2xl">
          {stripPunct(text)}
        </span>
        {showLatin && latin && (
          <span dir="ltr" lang={`${lang}-Latn`} className="text-[0.7rem] font-medium tracking-wide text-muted-foreground">
            {stripPunct(latin)}
          </span>
        )}
      </span>
      {shortcut !== undefined && state !== 'used' && (
        <kbd className="absolute -top-2 -start-2 hidden size-5 items-center justify-center rounded-md border bg-muted font-sans text-[0.65rem] text-muted-foreground shadow-xs sm:flex">
          {shortcut}
        </kbd>
      )}
    </button>
  )
}
