import { Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnswerInput } from '@/components/answer-input'
import { useCanSpeak } from '@/components/audio-button'
import { FeedbackPanel } from '@/components/feedback-panel'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { Disclosure } from '@/components/disclosure'
import { AlsoLine, hasWordExtras, WordCard, WordExtras } from '@/components/word-card'
import { conceptById, evidenceFor, sentencesFor } from '@/content'
import type { Concept } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { speak } from '@/lib/audio'
import { pickConceptDistractors, seededRandom, shuffle } from '@/lib/distractors'
import { matchBaseAnswer, type MatchGrade } from '@/lib/script/match'
import { gradeOutcome, Rating } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import type { ExerciseProps } from '../session/types'
import { recognitionStrings } from './strings'

type Mode = 'mc' | 'listen' | 'typed'

/*
 * Recognition: Sorani/Persian -> meaning.
 *  - New words are introduced with a full word card, then tested straight away.
 *  - Young cards are multiple choice (with listening-only variants when audio exists).
 *  - Once a word is stable (>= 10 days), the learner types the meaning instead:
 *    recall is a stronger memory test than recognising the answer among options.
 */
function chooseMode(item: ExerciseProps['item'], canSpeak: boolean, random: () => number): Mode {
  const card = item.card
  if (!card || item.isNew) return 'mc'
  if (card.stability >= 10) return 'typed'
  if (canSpeak && card.reps >= 2 && random() < 0.35) return 'listen'
  return 'mc'
}

export function RecognitionExercise({ item, lang, attempt, onDone }: ExerciseProps) {
  const concept = conceptById.get(item.itemId)
  if (!concept?.[lang]) return null
  return <RecognitionInner concept={concept} item={item} lang={lang} attempt={attempt} onDone={onDone} />
}

function RecognitionInner({ concept, item, lang, attempt, onDone }: ExerciseProps & { concept: Concept }) {
  const s = recognitionStrings.use()
  const c = common.use()
  const l = useLocalize()
  const baseLang = useSettings((st) => st.baseLang)
  const cards = useProgress((st) => st.cards)
  const compare = useSettings((st) => st.compare)
  const entry = concept[lang]!
  const audioUrl = entry.audio?.[0]?.url ?? evidenceFor('concept', lang, concept.id).audio
  const canSpeak = useCanSpeak(lang, audioUrl)

  const random = useMemo(() => seededRandom(`${item.key}:${attempt}`), [item.key, attempt])
  const [mode] = useState<Mode>(() => chooseMode(item, canSpeak, random))
  const [phase, setPhase] = useState<'intro' | 'question' | 'feedback'>(item.isNew && attempt === 0 ? 'intro' : 'question')
  const [chosen, setChosen] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [grade, setGrade] = useState<MatchGrade>('wrong')
  const shownAt = useRef(Date.now())
  const answeredAfter = useRef(0)

  const options = useMemo(() => {
    const known = new Set(
      Object.keys(cards)
        .filter((k) => k.startsWith(`${lang}:recognition:`))
        .map((k) => k.split(':')[2]),
    )
    const wrong = pickConceptDistractors(concept, lang, baseLang, 3, random, known)
    return shuffle([concept, ...wrong], random)
    // Options stay fixed for the lifetime of this exercise, even as cards change.
  }, [concept, lang, baseLang, random])

  useEffect(() => {
    if (phase === 'question') shownAt.current = Date.now()
  }, [phase])

  useEffect(() => {
    if (phase === 'question' && mode === 'listen') void speak({ lang, text: entry.primary.script, url: audioUrl })
  }, [phase, mode, lang, entry.primary.script, audioUrl])

  const finish = (g: MatchGrade) => {
    answeredAfter.current = Date.now() - shownAt.current
    setGrade(g)
    setPhase('feedback')
  }

  const answerMc = (id: string) => {
    if (phase !== 'question') return
    setChosen(id)
    finish(id === concept.id ? 'exact' : 'wrong')
  }

  useEffect(() => {
    if (phase !== 'question' || mode === 'typed') return
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= options.length) answerMc(options[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const submitTyped = () => {
    if (!typed.trim()) return
    const accepted =
      baseLang === 'sv'
        ? [concept.gloss.sv, ...(concept.gloss.svAlt ?? []), concept.gloss.en, ...(concept.gloss.enAlt ?? [])]
        : [concept.gloss.en, ...(concept.gloss.enAlt ?? []), concept.gloss.sv, ...(concept.gloss.svAlt ?? [])]
    finish(matchBaseAnswer(typed, accepted).grade)
  }

  const complete = () => {
    const ms = answeredAfter.current
    let g = gradeOutcome({ match: grade, hintsUsed: 0, attempts: 1, responseMs: ms, fastMs: mode === 'typed' ? 5000 : 2500 })
    // Picking from options overestimates knowledge, so multiple choice never earns "Easy".
    if (mode === 'mc' && g === Rating.Easy) g = Rating.Good
    onDone({ grade: g, kind: `recognition-${mode}`, ms })
  }

  const example = useMemo(
    () => sentencesFor(lang).find((st) => st[lang]!.tokens.some((t) => t.concept === concept.id)),
    [lang, concept.id],
  )

  if (phase === 'intro') {
    return (
      <div className="flex flex-col gap-6 animate-pop-in">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-mod-recognition">{s.newWord}</p>
        <WordCard concept={concept} lang={lang} autoPlay />
        {example?.[lang] && (
          <div className="rounded-2xl bg-muted/50 px-4 py-4">
            <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{s.example}</p>
            <TargetText lang={lang} text={example[lang]!.text} latin={example[lang]!.latin} size="sm" audio />
            <p className="mt-1 text-center text-sm text-muted-foreground">{l(example.translation)}</p>
          </div>
        )}
        {hasWordExtras(concept, lang, compare) && (
          <Disclosure label={c.feedback.more.word} className="mx-auto w-full max-w-md">
            <WordExtras concept={concept} lang={lang} />
          </Disclosure>
        )}
        <Button size="xl" onClick={() => setPhase('question')} autoFocus>
          {s.gotIt}
        </Button>
      </div>
    )
  }

  const showPrompt = mode !== 'listen' || phase === 'feedback'
  return (
    <div className="flex flex-col gap-6">
      <p className="text-center text-sm font-medium text-muted-foreground">
        {mode === 'listen' ? s.listenPrompt : s.whatMeans}
      </p>

      <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border bg-card px-4 py-8 shadow-sm">
        {showPrompt ? (
          <TargetText
            lang={lang}
            text={entry.primary.script}
            latin={entry.primary.latin}
            size="2xl"
            audio
            audioUrl={audioUrl}
            autoPlay={mode !== 'listen'}
            romanization={phase === 'feedback' ? 'always' : undefined}
          />
        ) : (
          <Button
            variant="outline"
            size="icon-lg"
            className="size-24 rounded-full border-2 text-primary"
            onClick={() => void speak({ lang, text: entry.primary.script, url: audioUrl })}
            aria-label={s.playAgain}
          >
            <Volume2 className="size-10" />
          </Button>
        )}
      </div>

      {mode === 'typed' ? (
        phase === 'question' && (
          <div className="space-y-2">
            <AnswerInput value={typed} onChange={setTyped} onSubmit={submitTyped} placeholder={s.typeMeaning} />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => finish('wrong')}>
                {s.dontKnow}
              </Button>
              <Button size="lg" className="flex-1" onClick={submitTyped} disabled={!typed.trim()}>
                {c.actions.check}
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="group">
          {options.map((o, i) => {
            const isAnswer = o.id === concept.id
            const state =
              phase === 'feedback' ? (isAnswer ? 'right' : o.id === chosen ? 'wrong' : 'dim') : 'idle'
            return (
              <button
                key={o.id}
                type="button"
                disabled={phase !== 'question'}
                onClick={() => answerMc(o.id)}
                className={cn(
                  'group flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-start text-lg font-medium shadow-xs transition',
                  state === 'idle' && 'hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md active:translate-y-0',
                  state === 'right' && 'border-success bg-success/10',
                  state === 'wrong' && 'animate-shake border-destructive bg-destructive/10',
                  state === 'dim' && 'opacity-50',
                )}
              >
                <kbd className="hidden size-6 shrink-0 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground sm:flex">
                  {i + 1}
                </kbd>
                <span>{l(o.gloss)}</span>
              </button>
            )
          })}
        </div>
      )}

      {phase === 'feedback' && (
        <FeedbackPanel
          grade={grade}
          onContinue={complete}
          details={hasWordExtras(concept, lang, compare) ? <WordExtras concept={concept} lang={lang} /> : undefined}
        >
          {mode === 'typed' && typed && grade !== 'exact' && (
            <p className="text-sm text-muted-foreground">
              {c.feedback.yourAnswer}: <span className="font-medium text-foreground">{typed}</span>
            </p>
          )}
          <div className="space-y-1 text-center">
            <p className="text-2xl font-semibold text-balance">{l(concept.gloss)}</p>
            {concept.senseNote && <p className="text-sm text-muted-foreground">{l(concept.senseNote)}</p>}
          </div>
          <AlsoLine forms={entry.variants ?? []} lang={lang} className="text-center" />
        </FeedbackPanel>
      )}
    </div>
  )
}
