import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { common } from '@/i18n/common'
import type { MatchGrade } from '@/lib/script/match'
import { cn } from '@/lib/utils'

interface FeedbackPanelProps {
  grade: MatchGrade
  /** Usually the correct answer and an explanation. */
  children?: ReactNode
  onContinue: () => void
  continueLabel?: string
}

const STYLE: Record<MatchGrade, { icon: typeof CheckCircle2; tone: string }> = {
  exact: { icon: CheckCircle2, tone: 'border-success/40 bg-success/10 text-success' },
  close: { icon: CheckCircle2, tone: 'border-success/40 bg-success/10 text-success' },
  typo: { icon: CircleAlert, tone: 'border-warning/50 bg-warning/15 text-amber-700 dark:text-warning' },
  wrong: { icon: XCircle, tone: 'border-destructive/40 bg-destructive/10 text-destructive' },
}

/**
 * Immediate corrective feedback after every answer. Enter or Space continues.
 */
export function FeedbackPanel({ grade, children, onContinue, continueLabel }: FeedbackPanelProps) {
  const s = common.use()
  const { icon: Icon, tone } = STYLE[grade]
  const button = useRef<HTMLButtonElement>(null)
  const title = { exact: s.feedback.correct, close: s.feedback.close, typo: s.feedback.typo, wrong: s.feedback.wrong }[grade]

  useEffect(() => {
    const t = setTimeout(() => button.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={cn('animate-pop-in rounded-2xl border-2 p-4 sm:p-5', tone)} role="status" aria-live="polite">
      <div className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Icon className="size-6" />
        {title}
      </div>
      {children && <div className="mb-4 space-y-3 text-foreground">{children}</div>}
      <Button
        ref={button}
        size="xl"
        className="w-full"
        variant={grade === 'wrong' ? 'destructive' : 'default'}
        onClick={onContinue}
      >
        {continueLabel ?? s.actions.continue}
      </Button>
    </div>
  )
}
