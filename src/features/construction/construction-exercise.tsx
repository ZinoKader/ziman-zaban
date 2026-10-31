import { useRef, useState } from 'react'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { sentenceById } from '@/content'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import type { ExerciseProps } from '../session/types'
import { SelfGrade } from '../session/self-grade'

/** Placeholder: translate in your head, reveal, self-grade. The full module replaces this. */
export function ConstructionExercise({ item, lang, onDone }: ExerciseProps) {
  const c = common.use()
  const l = useLocalize()
  const [revealed, setRevealed] = useState(false)
  const start = useRef(Date.now())
  const sentence = sentenceById.get(item.itemId)
  const form = sentence?.[lang]
  if (!sentence || !form) return null
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border bg-card px-4 py-10 text-center text-2xl font-semibold">{l(sentence.translation)}</div>
      {revealed ? (
        <>
          <TargetText lang={lang} text={form.text} latin={form.latin} size="lg" audio autoPlay />
          <SelfGrade onGrade={(grade) => onDone({ grade, kind: 'construction-self', ms: Date.now() - start.current })} />
        </>
      ) : (
        <Button size="xl" onClick={() => setRevealed(true)}>
          {c.actions.showAnswer}
        </Button>
      )}
    </div>
  )
}
