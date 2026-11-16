import { ImageOff, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChoiceButton } from '@/components/choice-button'
import { FeedbackPanel } from '@/components/feedback-panel'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { AlsoLine } from '@/components/word-card'
import { pictureById, pictureUrl, pictureWord, type PictureWord } from '@/content/pictures'
import type { Picture } from '@/content/types'
import { useLocalize } from '@/i18n'
import { seededRandom } from '@/lib/distractors'
import type { MatchGrade } from '@/lib/script/match'
import { gradeOutcome, Rating } from '@/lib/srs'
import { cn } from '@/lib/utils'
import type { ExerciseProps } from '../session/types'
import { pictureOptions } from './options'
import { picturesStrings } from './strings'

export function PicturesExercise({ item, lang, attempt, onDone }: ExerciseProps) {
  const picture = pictureById.get(item.itemId)
  const word = picture && pictureWord(picture, lang)
  if (!picture || !word) return null
  return <PicturesInner picture={picture} word={word} item={item} lang={lang} attempt={attempt} onDone={onDone} />
}

export function PictureFrame({ picture, className }: { picture: Picture; className?: string }) {
  const s = picturesStrings.use()
  const l = useLocalize()
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const { credit, license, source } = picture.image
  const alt = picture.gloss ? l(picture.gloss) : ''
  return (
    <figure className={cn('mx-auto w-full max-w-md space-y-1.5', className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted shadow-sm">
        {state === 'failed' ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
            <ImageOff className="size-8" />
            {s.noImage}
            {alt && <span className="font-medium text-foreground">{alt}</span>}
          </div>
        ) : (
          <img
            src={pictureUrl(picture)}
            alt={alt}
            width={720}
            height={540}
            onLoad={() => setState('ready')}
            onError={() => setState('failed')}
            className={cn('size-full object-cover transition-opacity duration-300', state === 'loading' && 'opacity-0')}
          />
        )}
        {state === 'loading' && <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />}
      </div>
      <figcaption className="text-end text-[0.7rem] text-muted-foreground">
        <a href={source} target="_blank" rel="noreferrer" className="hover:underline">
          {s.photo(credit, license)}
        </a>
      </figcaption>
    </figure>
  )
}

function PicturesInner({ picture, word, item, lang, attempt, onDone }: ExerciseProps & { picture: Picture; word: PictureWord }) {
  const s = picturesStrings.use()
  const l = useLocalize()
  const { entry } = word
  const audioUrl = entry.audio?.[0]?.url

  const seed = `${item.key}:${item.card?.reps ?? 0}:${attempt}`
  const random = useMemo(() => seededRandom(seed), [seed])
  const [phase, setPhase] = useState<'intro' | 'question' | 'feedback'>(item.isNew && attempt === 0 ? 'intro' : 'question')
  const [chosen, setChosen] = useState<string | null>(null)
  const [grade, setGrade] = useState<MatchGrade>('wrong')
  const shownAt = useRef(0)
  const answeredAfter = useRef(0)

  const options = useMemo(
    () => pictureOptions(picture, lang, 3, random).map((p) => ({ id: p.id, ...pictureWord(p, lang)! })),
    [picture, lang, random],
  )

  useEffect(() => {
    if (phase === 'question') shownAt.current = Date.now()
  }, [phase])

  const answer = (id: string) => {
    if (phase !== 'question') return
    answeredAfter.current = Date.now() - shownAt.current
    setChosen(id)
    setGrade(id === picture.id ? 'exact' : 'wrong')
    setPhase('feedback')
  }

  useEffect(() => {
    if (phase !== 'question') return
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= options.length) answer(options[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const complete = () => {
    const ms = answeredAfter.current
    let g = gradeOutcome({ match: grade, hintsUsed: 0, attempts: 1, responseMs: ms, fastMs: 2500 })
    // Picking from options overestimates knowledge, so multiple choice never earns "Easy".
    if (g === Rating.Easy) g = Rating.Good
    onDone({ grade: g, kind: 'pictures-mc', ms })
  }

  const picked = options.find((o) => o.id === chosen)

  const meaning = (
    <div className="space-y-1 text-center">
      <p className="text-xl font-semibold text-balance">{l(word.gloss)}</p>
      {word.senseNote && <p className="text-sm text-muted-foreground">{l(word.senseNote)}</p>}
    </div>
  )

  if (phase === 'intro') {
    return (
      <div className="flex flex-col gap-5">
        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-muted-foreground">
          <Sparkles className="size-4 text-mod-pictures" /> {s.newWord}
        </p>
        <PictureFrame picture={picture} />
        <div className="flex flex-col items-center gap-2">
          <TargetText lang={lang} text={entry.primary.script} latin={entry.primary.latin} size="xl" audio audioUrl={audioUrl} autoPlay />
          {meaning}
          <AlsoLine forms={entry.variants ?? []} lang={lang} className="text-center" />
        </div>
        <Button size="xl" onClick={() => setPhase('question')} autoFocus>
          {s.gotIt}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-center text-sm font-medium text-muted-foreground">{s.prompt}</p>
      <PictureFrame picture={picture} />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="group" aria-label={s.prompt}>
        {options.map((o, i) => {
          const isAnswer = o.id === picture.id
          const state = phase === 'feedback' ? (isAnswer ? 'right' : o.id === chosen ? 'wrong' : 'dim') : 'idle'
          return (
            <ChoiceButton
              key={o.id}
              index={i + 1}
              state={state}
              disabled={phase !== 'question'}
              onChoose={() => answer(o.id)}
              accent="hover:border-mod-pictures/60"
            >
              <TargetText lang={lang} text={o.entry.primary.script} latin={o.entry.primary.latin} size="md" className="flex-1" />
            </ChoiceButton>
          )
        })}
      </div>

      {phase === 'feedback' && (
        <FeedbackPanel grade={grade} onContinue={complete}>
          <div className="flex flex-col items-center gap-2">
            <TargetText
              lang={lang}
              text={entry.primary.script}
              latin={entry.primary.latin}
              size="xl"
              audio
              audioUrl={audioUrl}
              autoPlay
              romanization="always"
            />
            {meaning}
            <AlsoLine forms={entry.variants ?? []} lang={lang} className="text-center" />
            {picked && picked.id !== picture.id && <p className="text-center text-sm text-muted-foreground">{s.youPicked(l(picked.gloss))}</p>}
          </div>
        </FeedbackPanel>
      )}
    </div>
  )
}
