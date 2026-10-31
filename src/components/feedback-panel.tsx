import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { common } from '@/i18n/common'
import type { MatchGrade } from '@/lib/script/match'
import { cn } from '@/lib/utils'
import { Disclosure } from './disclosure'
import { PHONE_QUERY, useMediaQuery } from './use-media-query'

interface FeedbackPanelProps {
  grade: MatchGrade
  /** The essentials: the correct answer, and at most one line of explanation. */
  children?: ReactNode
  /** Everything else (notes, variants, breakdowns, the other language), collapsed until asked for. */
  details?: ReactNode
  detailsLabel?: string
  onContinue: () => void
  continueLabel?: string
  /** On phones, pin the continue button to the bottom of the screen so it never needs scrolling to. */
  dock?: boolean
}

const STYLE: Record<MatchGrade, { icon: typeof CheckCircle2; tone: string; title: string }> = {
  exact: { icon: CheckCircle2, tone: 'border-success/30 bg-success/8', title: 'text-success' },
  close: { icon: CheckCircle2, tone: 'border-success/30 bg-success/8', title: 'text-success' },
  typo: { icon: CircleAlert, tone: 'border-warning/40 bg-warning/10', title: 'text-amber-700 dark:text-warning' },
  wrong: { icon: XCircle, tone: 'border-destructive/30 bg-destructive/6', title: 'text-destructive' },
}

/**
 * Immediate corrective feedback after every answer: the verdict, the correct answer and one clear
 * way on. Enter or Space continues.
 */
export function FeedbackPanel({ grade, children, details, detailsLabel, onContinue, continueLabel, dock = true }: FeedbackPanelProps) {
  const s = common.use()
  const { icon: Icon, tone, title: titleTone } = STYLE[grade]
  const phone = useMediaQuery(PHONE_QUERY)
  const docked = dock && phone
  const panel = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const title = { exact: s.feedback.correct, close: s.feedback.close, typo: s.feedback.typo, wrong: s.feedback.wrong }[grade]

  useEffect(() => {
    const t = setTimeout(() => {
      const pinned = dock && !!window.matchMedia?.(PHONE_QUERY).matches
      button.current?.focus({ preventScroll: pinned })
      const el = panel.current
      if (!pinned || !el) return
      // The pinned button is always in view; make sure the verdict is too.
      if (el.getBoundingClientRect().top > window.innerHeight * 0.5) {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
      }
    }, 50)
    return () => clearTimeout(t)
  }, [dock])

  const continueButton = (
    <Button ref={button} size="xl" className="w-full" onClick={onContinue}>
      {continueLabel ?? s.actions.continue}
    </Button>
  )

  return (
    <>
      <div ref={panel} className={cn('animate-pop-in scroll-mt-4 rounded-2xl border p-4 sm:p-5', tone)} role="status" aria-live="polite">
        <p className={cn('flex items-center gap-2 text-lg font-semibold', titleTone)}>
          <Icon className="size-6 shrink-0" />
          {title}
        </p>
        {children && <div className="mt-4 space-y-3 text-foreground">{children}</div>}
        {details && (
          <Disclosure label={detailsLabel ?? s.feedback.more.word} className="mt-4 border-t border-foreground/10 pt-2">
            {details}
          </Disclosure>
        )}
        {!docked && <div className="mt-5">{continueButton}</div>}
      </div>
      {docked && (
        <>
          <div aria-hidden className="h-20 shrink-0" />
          {createPortal(
            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
              <div className="mx-auto max-w-2xl">{continueButton}</div>
            </div>,
            document.body,
          )}
        </>
      )}
    </>
  )
}
