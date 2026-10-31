import { useRef, useState } from 'react'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { conceptById } from '@/content'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import type { ExerciseProps } from '../session/types'
import { SelfGrade } from '../session/self-grade'

/** Placeholder: self-graded flashcard. The full module replaces this. */
export function RecallExercise({ item, lang, onDone }: ExerciseProps) {
  const c = common.use()
  const l = useLocalize()
  const [revealed, setRevealed] = useState(false)
  const start = useRef(Date.now())
  const concept = conceptById.get(item.itemId)
  const entry = concept?.[lang]
  if (!concept || !entry) return null
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border bg-card px-4 py-10 text-center text-3xl font-semibold">{l(concept.gloss)}</div>
      {revealed ? (
        <>
          <TargetText lang={lang} text={entry.primary.script} latin={entry.primary.latin} size="xl" audio autoPlay />
          <SelfGrade onGrade={(grade) => onDone({ grade, kind: 'recall-self', ms: Date.now() - start.current })} />
        </>
      ) : (
        <Button size="xl" onClick={() => setRevealed(true)}>
          {c.actions.showAnswer}
        </Button>
      )}
    </div>
  )
}
