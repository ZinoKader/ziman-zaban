import { useRef, useState } from 'react'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { qaById } from '@/content'
import { common } from '@/i18n/common'
import type { ExerciseProps } from '../session/types'
import { SelfGrade } from '../session/self-grade'

/** Placeholder: hear a question, answer aloud, compare with a model answer. The full module replaces this. */
export function ResponseExercise({ item, lang, onDone }: ExerciseProps) {
  const c = common.use()
  const [revealed, setRevealed] = useState(false)
  const start = useRef(Date.now())
  const qa = qaById.get(item.itemId)
  const form = qa?.[lang]
  if (!qa || !form) return null
  const answer = form.answers[0]
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border bg-card px-4 py-10">
        <TargetText lang={lang} text={form.question.text} latin={form.question.latin} size="lg" audio autoPlay />
      </div>
      {revealed ? (
        <>
          <TargetText lang={lang} text={answer.text} latin={answer.latin} size="md" audio />
          <SelfGrade onGrade={(grade) => onDone({ grade, kind: 'response-self', ms: Date.now() - start.current })} />
        </>
      ) : (
        <Button size="xl" onClick={() => setRevealed(true)}>
          {c.actions.showAnswer}
        </Button>
      )}
    </div>
  )
}
