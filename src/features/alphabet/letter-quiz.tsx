import { Check, Flame, RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { cn } from '@/lib/utils'
import { LETTERS, soundLabel } from './letters'
import { makeQuiz, type QuizQuestion } from './quiz'
import { alphabetStrings } from './strings'

const ROUND = 8
const ADVANCE_MS = 750

interface Answer {
  chosen: string
  correct: boolean
}

export function LetterQuiz({ lang, random = Math.random }: { lang: TargetLang; random?: () => number }) {
  const s = alphabetStrings.use()
  const l = useLocalize()
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const start = () => {
    window.clearTimeout(timer.current)
    setQuestions(makeQuiz(LETTERS[lang], ROUND, random))
    setIndex(0)
    setAnswer(null)
    setScore(0)
    setStreak(0)
  }

  const done = questions !== null && index >= questions.length
  const question = questions && !done ? questions[index] : null

  const next = () => {
    window.clearTimeout(timer.current)
    setAnswer(null)
    setIndex((i) => i + 1)
  }

  const choose = (char: string) => {
    if (!question || answer) return
    const correct = char === question.letter.char
    setAnswer({ chosen: char, correct })
    if (correct) {
      setScore((n) => n + 1)
      setStreak((n) => n + 1)
      timer.current = window.setTimeout(next, ADVANCE_MS)
    } else {
      setStreak(0)
    }
  }

  useEffect(() => {
    if (!question) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const n = Number(e.key)
      if (!answer && n >= 1 && n <= question.options.length) choose(question.options[n - 1].char)
      else if (answer && e.key === 'Enter') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!questions) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed bg-card/50 px-6 py-10 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-7" />
        </span>
        <p className="max-w-sm text-sm text-muted-foreground">{s.quiz.body}</p>
        <Button size="xl" onClick={start}>
          {s.quiz.start}
        </Button>
      </div>
    )
  }

  if (done) {
    const ratio = score / questions.length
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border-2 bg-card px-6 py-10 text-center animate-pop-in">
        <p className="text-5xl font-semibold tracking-tight text-primary">
          {score}
          <span className="text-2xl text-muted-foreground">/{questions.length}</span>
        </p>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{s.quiz.result(score, questions.length)}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">{s.quiz.verdict(ratio)}</p>
        </div>
        <div dir="rtl" className="flex flex-wrap justify-center gap-1.5">
          {questions.map((q) => (
            <span key={q.letter.char} lang={lang} className="grid size-10 place-items-center rounded-xl border bg-background font-script text-xl">
              {q.letter.char}
            </span>
          ))}
        </div>
        <Button size="xl" onClick={start} autoFocus>
          <RotateCcw /> {s.quiz.again}
        </Button>
      </div>
    )
  }

  const q = question!
  return (
    <div className="flex flex-col gap-5 rounded-3xl border-2 bg-card p-4 sm:p-6">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium text-muted-foreground tabular-nums">{s.quiz.progress(index + 1, questions.length)}</span>
        <Progress value={(index / questions.length) * 100} className="h-2 flex-1" />
        <span
          className={cn(
            'flex items-center gap-1 font-medium tabular-nums transition',
            streak >= 2 ? 'text-orange-600 dark:text-orange-400' : 'opacity-0',
          )}
          aria-hidden={streak < 2}
        >
          <Flame className="size-4" /> {s.quiz.streak(streak)}
        </span>
      </div>

      <p className="text-center text-sm font-medium text-muted-foreground">{s.quiz.prompt}</p>
      <div key={q.letter.char} className="flex justify-center animate-pop-in">
        <span dir="rtl" lang={lang} className="grid size-32 place-items-center rounded-3xl border-2 bg-background font-script text-7xl leading-none shadow-sm">
          {q.letter.char}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label={s.quiz.prompt}>
        {q.options.map((o, i) => {
          const isAnswer = o.char === q.letter.char
          const state = !answer ? 'idle' : isAnswer ? 'right' : o.char === answer.chosen ? 'wrong' : 'dim'
          return (
            <button
              key={o.char}
              type="button"
              disabled={!!answer}
              onClick={() => choose(o.char)}
              className={cn(
                'relative flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 bg-background px-3 py-2 shadow-xs transition',
                state === 'idle' && 'hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md active:translate-y-0',
                state === 'right' && 'border-success bg-success/10',
                state === 'wrong' && 'animate-shake border-destructive bg-destructive/10',
                state === 'dim' && 'opacity-50',
              )}
            >
              <kbd className="absolute start-2 top-2 hidden size-5 items-center justify-center rounded border bg-muted text-[0.65rem] text-muted-foreground sm:flex">
                {i + 1}
              </kbd>
              <span lang={`${lang}-Latn`} className="text-xl font-semibold">{soundLabel(o)}</span>
              <span className="font-mono text-xs text-muted-foreground">[{o.ipa.join(', ')}]</span>
            </button>
          )
        })}
      </div>

      <div className="flex min-h-12 items-center justify-between gap-3" aria-live="polite">
        {answer && (
          <>
            <p className={cn('flex items-center gap-2 text-sm font-medium', answer.correct ? 'text-success' : 'text-destructive')}>
              {answer.correct ? <Check className="size-5" /> : <X className="size-5" />}
              <span>
                {answer.correct ? s.quiz.correct : s.quiz.wrong(soundLabel(q.letter))}
                <span className="ms-1.5 font-normal text-muted-foreground">{l(q.letter.hint)}</span>
              </span>
            </p>
            {!answer.correct && (
              <Button onClick={next} autoFocus>
                {s.quiz.next}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
