import { Lightbulb, Mic } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnswerInput, type AnswerInputHandle } from '@/components/answer-input'
import { Disclosure } from '@/components/disclosure'
import { FeedbackPanel } from '@/components/feedback-panel'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { acceptedForms, conceptById } from '@/content'
import type { Concept } from '@/content/types'
import { common } from '@/i18n/common'
import { seededRandom } from '@/lib/distractors'
import type { MatchResult } from '@/lib/script/match'
import type { Grade } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { SelfGrade } from '../session/self-grade'
import type { ExerciseProps } from '../session/types'
import { AnswerDetails, AnswerExtras, hasAnswerExtras } from './components/answer-details'
import { AnswerDiff } from './components/answer-diff'
import { HintMask } from './components/hint-mask'
import { RecallPrompt } from './components/recall-prompt'
import { chooseMode, closestForm, fastMsFor, matchRecall, modeSeed, recallGrade, scriptOf } from './grading'
import { hintSlots, maxHintLevel } from './hints'
import { recallStrings } from './strings'

/*
 * Recall: meaning -> Sorani/Persian word, produced from memory.
 *  - The learner types the word (Arabic script or Latin letters); no options to pick from.
 *  - Hints reveal letters one by one but cap the grade at Hard.
 *  - After a miss, the learner types the correct form once before moving on.
 *  - Well-known words are sometimes said aloud and self-graded instead.
 */

/** Bottom-anchored on phones so the main action stays in reach of the thumb. */
const MOBILE_DOCK = 'max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:bg-background/95 max-sm:px-4 max-sm:pb-safe max-sm:pt-2 max-sm:backdrop-blur'
const MOBILE_DOCK_IN_CARD = cn(MOBILE_DOCK, 'max-sm:bg-card/95')

export function RecallExercise({ item, lang, attempt, onDone }: ExerciseProps) {
  const concept = conceptById.get(item.itemId)
  if (!concept?.[lang]) return null
  return <RecallInner concept={concept} item={item} lang={lang} attempt={attempt} onDone={onDone} />
}

type Phase = 'question' | 'feedback' | 'copy'

function RecallInner({ concept, item, lang, attempt, onDone }: ExerciseProps & { concept: Concept }) {
  const s = recallStrings.use()
  const c = common.use()
  const answerScript = useSettings((st) => st.answerScript)
  const compare = useSettings((st) => st.compare)
  const report = useProgress((st) => st.report)
  const entry = concept[lang]!
  const forms = useMemo(() => acceptedForms(entry), [entry])

  const [mode] = useState(() => chooseMode(item, attempt, seededRandom(modeSeed(item, attempt))))
  const [phase, setPhase] = useState<Phase>('question')
  const [typed, setTyped] = useState('')
  const [hintLevel, setHintLevel] = useState(0)
  const [result, setResult] = useState<MatchResult | null>(null)
  const [overridden, setOverridden] = useState(false)
  const shownAt = useRef(Date.now())
  const answerMs = useRef(0)
  const input = useRef<AnswerInputHandle>(null)

  const hintScript = typed.trim() ? scriptOf(typed) : answerScript
  const canHint = phase === 'question' && hintLevel < maxHintLevel(hintSlots(entry.primary, hintScript))

  const takeHint = () => {
    if (!canHint) return
    setHintLevel((h) => h + 1)
    input.current?.focus()
  }

  const submit = () => {
    if (phase !== 'question' || !typed.trim()) return
    answerMs.current = Date.now() - shownAt.current
    setResult(matchRecall(typed, forms, lang))
    setPhase('feedback')
  }

  const giveUp = () => {
    if (phase !== 'question') return
    answerMs.current = Date.now() - shownAt.current
    setTyped('')
    setResult({ grade: 'wrong', expected: entry.primary, inputScript: answerScript })
    setPhase('feedback')
  }

  const reveal = () => {
    if (phase !== 'question') return
    answerMs.current = Date.now() - shownAt.current
    setPhase('feedback')
  }

  const finish = (grade: Grade, kind: string) => onDone({ grade, kind, ms: answerMs.current })

  const completeTyped = () => {
    if (!result) return
    const grade = recallGrade({
      match: result.grade,
      hintsUsed: hintLevel,
      responseMs: answerMs.current,
      fastMs: fastMsFor(result.expected, result.inputScript),
      attempt,
      overridden,
    })
    finish(grade, overridden ? 'recall-override' : 'recall-typed')
  }

  const completeSpoken = (selfGrade: Grade) => {
    const grade = recallGrade({ match: null, selfGrade, hintsUsed: hintLevel, responseMs: answerMs.current, fastMs: 0, attempt })
    finish(grade, 'recall-spoken')
  }

  const claimRight = () => {
    report(
      `concept:${lang}:${concept.id}`,
      `Recall: "${typed.trim()}" was marked wrong for "${concept.gloss.en}" but the learner says it is correct.`,
    )
    setOverridden(true)
  }

  useEffect(() => {
    if (phase !== 'question') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h')) {
        e.preventDefault()
        takeHint()
        return
      }
      const onControl = e.target instanceof HTMLElement && e.target.closest('button, input, textarea')
      if (mode === 'spoken' && !onControl && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        reveal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hintButton = (
    <Button
      variant="outline"
      size="xl"
      onClick={takeHint}
      disabled={!canHint}
      className="px-3.5"
      aria-keyshortcuts="? Control+H"
      title={hintLevel > 0 ? s.moreHint : undefined}
    >
      <Lightbulb className={cn(hintLevel > 0 && 'fill-mod-recall/30 text-mod-recall')} />
      <span className="max-[360px]:sr-only">{s.hint}</span>
    </Button>
  )

  if (mode === 'spoken') {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-center text-sm font-medium text-muted-foreground">{s.sayPrompt[lang]}</p>
        <RecallPrompt concept={concept} />
        {phase === 'question' ? (
          <>
            {hintLevel > 0 && <HintMask form={entry.primary} lang={lang} script={answerScript} level={hintLevel} />}
            <div className="flex items-center justify-center gap-3 text-muted-foreground">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-mod-recall/15 text-mod-recall">
                <Mic className="size-6" />
              </span>
              <p className="max-w-sm text-sm">{s.sayHelp}</p>
            </div>
            <div className={cn('grid grid-cols-[auto_1fr] gap-2', MOBILE_DOCK)}>
              {hintButton}
              <Button size="xl" onClick={reveal} autoFocus>
                {c.actions.showAnswer}
              </Button>
            </div>
          </>
        ) : (
          <div className="animate-pop-in space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
            <AnswerDetails concept={concept} lang={lang} shown={entry.primary} autoPlay />
            {hasAnswerExtras(concept, lang, entry.primary, compare) && (
              <Disclosure label={c.feedback.more.word} className="border-t pt-2">
                <AnswerExtras concept={concept} lang={lang} shown={entry.primary} />
              </Disclosure>
            )}
            <p className="text-center text-sm font-medium text-muted-foreground">{s.howDidItGo}</p>
            <div className={MOBILE_DOCK_IN_CARD}>
              <SelfGrade onGrade={completeSpoken} />
            </div>
          </div>
        )}
      </div>
    )
  }

  const wrong = result?.grade === 'wrong' && !overridden
  const featured = wrong || !result ? entry.primary : result.expected
  const shownGrade = overridden ? 'exact' : (result?.grade ?? 'wrong')
  const inputState =
    phase === 'question' ? 'idle' : wrong ? 'wrong' : result?.grade === 'typo' ? 'close' : 'correct'

  return (
    <div className="flex flex-col gap-6">
      <p className="text-center text-sm font-medium text-muted-foreground">{s.prompt[lang]}</p>
      <RecallPrompt concept={concept} />

      {phase !== 'copy' && (phase === 'question' || typed) && (
        <div className="space-y-3">
          {phase === 'question' && hintLevel > 0 && (
            <HintMask form={entry.primary} lang={lang} script={hintScript} level={hintLevel} />
          )}
          <AnswerInput
            ref={input}
            lang={lang}
            value={typed}
            onChange={setTyped}
            onSubmit={submit}
            disabled={phase !== 'question'}
            state={inputState}
            placeholder={s.placeholder[answerScript]}
          />
        </div>
      )}

      {phase === 'question' && (
        <div className={cn('space-y-2', MOBILE_DOCK)}>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
            {hintButton}
            <Button variant="ghost" size="xl" onClick={giveUp} className="min-w-0 whitespace-normal px-2 leading-tight">
              {s.dontKnow}
            </Button>
            <Button size="xl" onClick={submit} disabled={!typed.trim()}>
              {c.actions.check}
            </Button>
          </div>
          <p className="hidden items-center justify-center gap-3 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1">
              <Kbd>Enter</Kbd> {s.shortcuts.check}
            </span>
            <span className="flex items-center gap-1">
              <Kbd>?</Kbd> {s.shortcuts.hint}
            </span>
          </p>
        </div>
      )}

      {phase === 'feedback' && result && (
        <FeedbackPanel
          key={overridden ? 'overridden' : 'judged'}
          grade={shownGrade}
          onContinue={wrong ? () => setPhase('copy') : completeTyped}
          continueLabel={wrong ? s.copyCta : undefined}
          details={
            hasAnswerExtras(concept, lang, featured, compare) ? (
              <AnswerExtras concept={concept} lang={lang} shown={featured} />
            ) : undefined
          }
        >
          {typed && result.grade !== 'exact' && !overridden && (
            <Labeled label={c.feedback.yourAnswer}>
              <AnswerDiff input={typed} form={wrong ? closestForm(typed, forms, lang) : result.expected} lang={lang} />
            </Labeled>
          )}
          {overridden && <p className="text-center text-sm text-success">{s.overridden}</p>}
          <AnswerDetails
            concept={concept}
            lang={lang}
            shown={featured}
            caption={result.grade === 'exact' || overridden ? undefined : wrong ? c.feedback.expected : s.exactSpelling}
            autoPlay
          />
          {wrong && typed && (
            <p className="text-center">
              <button
                type="button"
                onClick={claimRight}
                title={s.iWasRightHelp}
                className="rounded text-xs text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                {s.iWasRight}
              </button>
            </p>
          )}
        </FeedbackPanel>
      )}

      {phase === 'copy' && <CopyPractice concept={concept} lang={lang} onDone={completeTyped} />}
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

/** Typing the right form once straight after a miss (with the model in view) strengthens the new memory. */
function CopyPractice({ concept, lang, onDone }: { concept: Concept; lang: ExerciseProps['lang']; onDone: () => void }) {
  const s = recallStrings.use()
  const c = common.use()
  const primary = concept[lang]!.primary
  const [value, setValue] = useState('')
  const [state, setState] = useState<'idle' | 'wrong' | 'correct'>('idle')
  const [missed, setMissed] = useState('')

  const check = () => {
    if (state === 'correct') return onDone()
    if (!value.trim()) return
    const { grade } = matchRecall(value, [primary], lang)
    setMissed(grade === 'exact' ? '' : value)
    setState(grade === 'exact' || grade === 'close' ? 'correct' : 'wrong')
  }

  return (
    <div className="animate-pop-in space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="space-y-1 text-center">
        <p className="text-lg font-semibold">{s.copyTitle}</p>
        <p className="text-sm text-muted-foreground">{s.copyHelp}</p>
      </div>
      <TargetText lang={lang} text={primary.script} latin={primary.latin} size="xl" audio romanization="always" />
      <AnswerInput
        lang={lang}
        value={value}
        onChange={(v) => {
          setValue(v)
          if (state === 'wrong') setState('idle')
        }}
        onSubmit={check}
        disabled={state === 'correct'}
        state={state === 'correct' ? 'correct' : state === 'wrong' ? 'wrong' : 'idle'}
        placeholder={s.copyPlaceholder}
      />
      {state === 'wrong' && (
        <div className="space-y-1" role="status">
          <p className="text-sm font-medium text-destructive">{s.copyAgain}</p>
          <AnswerDiff input={missed} form={primary} lang={lang} />
        </div>
      )}
      {state === 'correct' && (
        <div className="animate-pop-in space-y-1 text-center" role="status">
          <p className="font-medium text-success">{s.copyDone}</p>
          {missed && (
            <>
              <p className="text-xs text-muted-foreground">{s.exactSpelling}</p>
              <AnswerDiff input={missed} form={primary} lang={lang} />
            </>
          )}
        </div>
      )}
      <div className={cn('grid grid-cols-2 gap-2', MOBILE_DOCK_IN_CARD)}>
        {state === 'correct' ? (
          <Button size="xl" className="col-span-2" onClick={onDone} autoFocus>
            {c.actions.continue}
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="xl" onClick={onDone}>
              {c.actions.skip}
            </Button>
            <Button size="xl" onClick={check} disabled={!value.trim()}>
              {c.actions.check}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
