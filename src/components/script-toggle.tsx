import { cn } from '@/lib/utils'
import { defineStrings } from '@/i18n'
import { useSettings } from '@/store/settings'

const strings = defineStrings({
  en: { show: 'Show script', hide: 'Hide script', label: 'Show Arabic script' },
  sv: { show: 'Visa skrift', hide: 'Dölj skrift', label: 'Visa arabisk skrift' },
})

/**
 * Whether Arabic script appears next to romanization. Learners who switched romanization to
 * `tap` or `never` read the script itself, so for them it is always shown.
 */
export function useShowScript(): boolean {
  return useSettings((s) => s.showScript || s.romanization !== 'always')
}

/** Session-wide switch for the Arabic script, e.g. in the session header. Saved as a setting. */
export function ScriptToggle({ className }: { className?: string }) {
  const s = strings.use()
  const romanization = useSettings((st) => st.romanization)
  const showScript = useSettings((st) => st.showScript)
  const set = useSettings((st) => st.set)
  if (romanization !== 'always') return null
  return (
    <button
      type="button"
      onClick={() => set({ showScript: !showScript })}
      aria-pressed={showScript}
      aria-label={s.label}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
        showScript ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
        className,
      )}
    >
      <span lang="fa" className="font-script text-sm leading-none" aria-hidden>
        اب
      </span>
      {showScript ? s.hide : s.show}
    </button>
  )
}

/** Small inline link that reveals the script for one piece of text. */
export function RevealScriptButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const s = strings.use()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={s.label}
      className={cn('rounded-md px-1.5 py-0.5 text-xs text-muted-foreground/80 transition hover:bg-muted hover:text-foreground', className)}
    >
      <span lang="fa" className="me-1 font-script" aria-hidden>
        اب
      </span>
      {s.show}
    </button>
  )
}
