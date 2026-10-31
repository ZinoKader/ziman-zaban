import type { ReactNode } from 'react'
import type { TargetLang } from '@/content/types'
import { cn } from '@/lib/utils'
import { SPEAKERS } from '../speakers'

/** The friendly conversation partner, on the right-to-left side of the chat. */
export function SpeakerBubble({ lang, label, children }: { lang: TargetLang; label: string; children: ReactNode }) {
  const speaker = SPEAKERS[lang]
  return (
    <div className="flex animate-pop-in flex-row-reverse items-end gap-2.5">
      <div
        aria-hidden
        lang={lang}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mod-response/25 to-mod-response/5 font-script text-xl font-semibold text-mod-response ring-2 ring-mod-response/20"
      >
        {speaker.initial}
      </div>
      <div className="flex min-w-0 max-w-[88%] flex-col items-end gap-1">
        <span className="px-2 text-xs font-medium text-muted-foreground">{label}</span>
        <div className="w-full rounded-3xl rounded-br-md border bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">{children}</div>
      </div>
    </div>
  )
}

/** The learner's own answer, on the other side. */
export function LearnerBubble({ label, tone = 'neutral', children }: { label: string; tone?: 'neutral' | 'right' | 'wrong'; children: ReactNode }) {
  return (
    <div className="flex animate-pop-in items-end gap-2.5">
      <div
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-2 ring-primary/15"
      >
        {label.slice(0, 1)}
      </div>
      <div className="flex min-w-0 max-w-[85%] flex-col items-start gap-1">
        <span className="px-2 text-xs font-medium text-muted-foreground">{label}</span>
        <div
          className={cn(
            'rounded-3xl rounded-bl-md border-2 px-4 py-3',
            tone === 'neutral' && 'border-primary/20 bg-primary/10',
            tone === 'right' && 'border-success/40 bg-success/10',
            tone === 'wrong' && 'border-destructive/30 bg-destructive/5',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
