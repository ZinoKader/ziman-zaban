import { ArrowLeft, Check, CheckCircle2, ClipboardPaste, SkipForward, Undo2, X, XCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { AnswerInput, type AnswerInputHandle } from '@/components/answer-input'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TargetLang } from '@/content/types'
import { cn } from '@/lib/utils'
import { ISSUES, parseComment, type Decision, type IncorrectDetail, type Issue } from './export'
import { reviewStrings } from './strings'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true
  return !!target.closest('[role="listbox"],[role="menu"],[role="dialog"]')
}

interface DecisionPanelProps {
  lang: TargetLang
  /** The item's main target-language text, offered as a starting point for the correction. */
  currentText: string
  decision?: Decision
  canBack: boolean
  onCorrect: () => void
  onIncorrect: (detail: IncorrectDetail) => void
  onSkip: () => void
  onBack: () => void
  onUndo: () => void
}

/** Remount with `key={itemKey}` so the flag form resets for every item. */
export function DecisionPanel({ lang, currentText, decision, canBack, onCorrect, onIncorrect, onSkip, onBack, onUndo }: DecisionPanelProps) {
  const s = reviewStrings.use()
  const [flagging, setFlagging] = useState(false)

  useEffect(() => {
    if (flagging) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return
      const k = e.key.toLowerCase()
      if (k === 'a' || k === '1') onCorrect()
      else if (k === 'x' || k === '2') setFlagging(true)
      else if (k === 's') onSkip()
      else if ((k === 'b' || k === 'arrowleft') && canBack) onBack()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flagging, canBack, onCorrect, onSkip, onBack])

  return (
    // A fragment, so the sticky action bar is positioned within the whole review column.
    <>
      {decision && <DecisionBanner decision={decision} onUndo={onUndo} />}
      {flagging ? (
        <FlagForm
          lang={lang}
          currentText={currentText}
          initial={decision?.verdict === 'incorrect' ? decision : undefined}
          onCancel={() => setFlagging(false)}
          onSave={onIncorrect}
        />
      ) : (
        <div
          className={cn(
            'sticky z-30 -mx-1 flex items-stretch gap-2 rounded-2xl border bg-background/90 p-1.5 shadow-lg backdrop-blur',
            'bottom-[calc(3.75rem+max(env(safe-area-inset-bottom),0.5rem))] lg:bottom-4',
          )}
        >
          <Button variant="ghost" className="h-14 w-12 shrink-0 flex-col gap-0.5 rounded-xl px-0 text-xs" onClick={onBack} disabled={!canBack} aria-label={s.back}>
            <ArrowLeft className="size-5" />
            <Kbd className="hidden sm:inline-flex">B</Kbd>
          </Button>
          <Button
            variant="destructive"
            className={cn('h-14 flex-1 rounded-xl text-base', decision?.verdict === 'incorrect' && 'ring-2 ring-destructive')}
            onClick={() => setFlagging(true)}
            aria-keyshortcuts="X 2"
          >
            <X className="size-5" /> {s.incorrect}
            <Kbd className="ms-1 hidden bg-destructive/15 text-destructive sm:inline-flex">X</Kbd>
          </Button>
          <Button
            className={cn(
              'h-14 flex-[1.3] rounded-xl bg-success text-base text-success-foreground hover:bg-success/85',
              decision?.verdict === 'correct' && 'ring-2 ring-success ring-offset-2 ring-offset-background',
            )}
            onClick={onCorrect}
            aria-keyshortcuts="A 1"
          >
            <Check className="size-5" /> {s.correct}
            <Kbd className="ms-1 hidden bg-black/15 text-current sm:inline-flex">A</Kbd>
          </Button>
          <Button variant="ghost" className="h-14 w-12 shrink-0 flex-col gap-0.5 rounded-xl px-0 text-xs" onClick={onSkip} aria-label={s.skip} aria-keyshortcuts="S">
            <SkipForward className="size-5" />
            <Kbd className="hidden sm:inline-flex">S</Kbd>
          </Button>
        </div>
      )}
    </>
  )
}

function DecisionBanner({ decision, onUndo }: { decision: Decision; onUndo: () => void }) {
  const s = reviewStrings.use()
  const ok = decision.verdict === 'correct'
  const Icon = ok ? CheckCircle2 : XCircle
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm animate-pop-in',
        ok ? 'border-success/40 bg-success/10' : 'border-destructive/40 bg-destructive/10',
      )}
      role="status"
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', ok ? 'text-success' : 'text-destructive')} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium">{ok ? s.markedCorrect(decision.date) : s.markedIncorrect(decision.date)}</p>
        {decision.comment && (
          <p dir="auto" className="break-words text-muted-foreground">
            {decision.comment}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{s.canChange}</p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onUndo} aria-label={s.removeDecision} title={s.removeDecision}>
        <Undo2 />
      </Button>
    </div>
  )
}

function initialDetail(initial?: Decision): IncorrectDetail {
  if (!initial) return { issues: [], correctForm: '', note: '' }
  if (initial.issues || initial.correctForm || initial.note)
    return { issues: initial.issues ?? [], correctForm: initial.correctForm ?? '', note: initial.note ?? '' }
  return parseComment(initial.comment ?? '')
}

interface FlagFormProps {
  lang: TargetLang
  currentText: string
  initial?: Decision
  onCancel: () => void
  onSave: (detail: IncorrectDetail) => void
}

function FlagForm({ lang, currentText, initial, onCancel, onSave }: FlagFormProps) {
  const s = reviewStrings.use()
  const [start] = useState(() => initialDetail(initial))
  const [issues, setIssues] = useState<Issue[]>(start.issues)
  const [correctForm, setCorrectForm] = useState(start.correctForm)
  const [note, setNote] = useState(start.note)
  const [error, setError] = useState(false)
  const input = useRef<AnswerInputHandle>(null)
  const root = useRef<HTMLDivElement>(null)
  const ids = { form: useId(), note: useId(), error: useId() }

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true
    root.current?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  const save = () => {
    if (!correctForm.trim() && !note.trim()) return setError(true)
    onSave({ issues, correctForm, note })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const toggle = (i: Issue) => setIssues((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : ISSUES.filter((x) => x === i || xs.includes(x))))

  return (
    <div ref={root} className="space-y-4 rounded-2xl border-2 border-destructive/40 bg-card p-4 shadow-sm animate-pop-in" role="group" aria-label={s.flagTitle}>
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <XCircle className="size-5" /> {s.flagTitle}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ISSUES.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={issues.includes(i)}
            onClick={() => toggle(i)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition',
              issues.includes(i) ? 'border-destructive bg-destructive/10 text-destructive' : 'hover:bg-muted',
            )}
          >
            {s.issues[i]}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label id={ids.form}>{s.correctForm}</Label>
          {currentText && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => {
                setCorrectForm(currentText)
                input.current?.focus()
              }}
            >
              <ClipboardPaste /> {s.useCurrent}
            </Button>
          )}
        </div>
        <div role="group" aria-labelledby={ids.form} aria-describedby={ids.error}>
          <AnswerInput
            ref={input}
            lang={lang}
            value={correctForm}
            onChange={(v) => {
              setCorrectForm(v)
              setError(false)
            }}
            onSubmit={save}
          />
        </div>
        <p className="text-xs text-muted-foreground">{s.correctFormHint}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={ids.note}>{s.comment}</Label>
        <Textarea
          id={ids.note}
          dir="auto"
          rows={2}
          value={note}
          placeholder={s.commentPlaceholder}
          aria-invalid={error || undefined}
          aria-describedby={ids.error}
          onChange={(e) => {
            setNote(e.target.value)
            setError(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              save()
            }
          }}
        />
      </div>
      <p id={ids.error} className={cn('text-sm text-destructive', !error && 'sr-only')} aria-live="polite">
        {error ? s.required : ''}
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" size="xl" className="flex-1" onClick={onCancel}>
          {s.cancel}
          <Kbd className="hidden sm:inline-flex">Esc</Kbd>
        </Button>
        <Button variant="destructive" size="xl" className="flex-[2] bg-destructive text-white hover:bg-destructive/90" onClick={save}>
          {s.saveFlag}
          <Kbd className="hidden bg-white/20 text-white sm:inline-flex">Enter</Kbd>
        </Button>
      </div>
    </div>
  )
}
