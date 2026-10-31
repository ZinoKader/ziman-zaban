import { AudioLines, Eye, Keyboard, Languages, Mic, Square, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnswerInput } from '@/components/answer-input'
import { useCanSpeak } from '@/components/audio-button'
import { Disclosure } from '@/components/disclosure'
import { FeedbackPanel } from '@/components/feedback-panel'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { evidenceFor, qaById, qaFor } from '@/content'
import type { QAForm, QAItem } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { speak } from '@/lib/audio'
import { seededRandom } from '@/lib/distractors'
import type { Grade } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { SelfGrade } from '../session/self-grade'
import type { ExerciseProps } from '../session/types'
import { AnswerLine } from './components/answer-line'
import { LearnerBubble, SpeakerBubble } from './components/chat-bubble'
import { MakeItYours } from './components/make-it-yours'
import { ModelAnswers } from './components/model-answers'
import { QuestionText } from './components/question-text'
import { TileBuilder } from './components/tile-builder'
import { buildChoiceOptions, buildTiles, checkTiles, chooseMode, finalGrade } from './options'
import { useOwnValues } from './personal-store'
import { SPEAKERS } from './speakers'
import { responseStrings } from './strings'
import { captureSlots, displayValues, fillAnswer, isTemplate, matchQAAnswer, sameText, type AnswerMatch } from './template'
import { canRecord, useDictation, useRecorder } from './use-recorder'

/*
 * Questions & answers: hear (or read) a question in Sorani/Persian and answer it in the same language.
 * The answer step is scaffolded by card state (see `chooseMode`): choose a fitting answer,
 * then build it from tiles, then answer freely by typing or speaking.
 */

type Kind = 'choose' | 'build' | 'typed' | 'spoken' | 'said'

/** How long the question is heard before its text fades in, for learners still choosing answers. */
const LISTEN_FIRST_MS = 1200
/** Voices load asynchronously; wait this long before deciding there is none. */
const VOICE_WAIT_MS = 350

const BOTTOM_BAR =
  'sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none'

export function ResponseExercise(props: ExerciseProps) {
  const qa = qaById.get(props.item.itemId)
  const form = qa?.[props.lang]
  if (!qa || !form) return null
  return <ResponseInner {...props} qa={qa} form={form} />
}

function ResponseInner({ qa, form, item, lang, attempt, onDone }: ExerciseProps & { qa: QAItem; form: QAForm }) {
  const s = responseStrings.use()
  const c = common.use()
  const l = useLocalize()
  const autoplay = useSettings((st) => st.autoplayAudio)
  const romanization = useSettings((st) => st.romanization)
  const questionAudio = evidenceFor('qa', lang, qa.id).audio
  const canSpeak = useCanSpeak(lang, questionAudio)

  const seed = `${item.key}:${item.card?.reps ?? 0}:${attempt}`
  const [mode] = useState(() => chooseMode(item, form, attempt))
  const pool = useMemo(() => qaFor(lang), [lang])
  const options = useMemo(
    () => (mode === 'choose' ? buildChoiceOptions(qa, lang, pool, seededRandom(`${seed}:choose`)) : []),
    [mode, qa, lang, pool, seed],
  )
  const tiles = useMemo(
    () => (mode === 'build' ? buildTiles(qa, lang, pool, seededRandom(`${seed}:tiles`)) : null),
    [mode, qa, lang, pool, seed],
  )

  const [phase, setPhase] = useState<'question' | 'feedback'>('question')
  const [via, setVia] = useState<'type' | 'speak'>('type')
  const [kind, setKind] = useState<Kind>(mode === 'free' ? 'typed' : mode)
  const [hintUsed, setHintUsed] = useState(false)
  const [textRevealed, setTextRevealed] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  const [tileIds, setTileIds] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<AnswerMatch>({ grade: 'wrong', index: -1 })
  const shownAt = useRef(0)
  const answerMs = useRef(0)
  const done = useRef(false)
  useEffect(() => {
    shownAt.current = Date.now()
  }, [])

  const recorder = useRecorder(() => finishSpoken('spoken'))
  const [recordingSupported] = useState(canRecord)
  const dictation = useDictation(lang === 'fa', setTyped)

  const [waitedForVoice, setWaitedForVoice] = useState(false)
  const [voiced, setVoiced] = useState<boolean | null>(null)
  if (voiced === null && (canSpeak || waitedForVoice)) setVoiced(canSpeak)
  const [listenedLongEnough, setListenedLongEnough] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setWaitedForVoice(true), VOICE_WAIT_MS)
    return () => clearTimeout(t)
  }, [])

  const played = useRef(false)
  useEffect(() => {
    if (!voiced || played.current) return
    played.current = true
    if (autoplay) void speak({ lang, text: form.question.text, url: questionAudio })
    if (mode === 'choose') {
      const t = setTimeout(() => setListenedLongEnough(true), LISTEN_FIRST_MS)
      return () => clearTimeout(t)
    }
  }, [voiced, autoplay, lang, form.question.text, questionAudio, mode])

  const textVisible =
    phase === 'feedback' || voiced === false || textRevealed || (voiced === true && mode === 'choose' && (listenedLongEnough || !autoplay))

  const finish = (r: AnswerMatch, k: Kind) => {
    if (phase !== 'question') return
    answerMs.current = Date.now() - shownAt.current
    setResult(r)
    setKind(k)
    setPhase('feedback')
  }

  const answerChoice = (id: string) => {
    const option = options.find((o) => o.id === id)
    if (!option || phase !== 'question') return
    setChosen(id)
    const index = option.correct ? form.answers.findIndex((a) => sameText(a.text, option.text, lang)) : -1
    finish({ grade: option.correct ? 'exact' : 'wrong', index }, 'choose')
  }

  const selectedTiles = tiles ? tileIds.map((id) => tiles.bank.find((t) => t.id === id)!) : []
  const checkBuild = () => {
    if (!tiles || !tileIds.length) return
    finish(checkTiles(selectedTiles, form, lang), 'build')
  }

  const submitTyped = () => {
    if (!typed.trim()) return
    finish(matchQAAnswer(typed, form.answers, lang), 'typed')
  }

  function finishSpoken(k: 'spoken' | 'said') {
    finish({ grade: 'exact', index: -1 }, k)
  }

  useEffect(() => {
    if (phase !== 'question') return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (mode === 'choose') {
        const n = Number(e.key)
        if (n >= 1 && n <= options.length) answerChoice(options[n - 1].id)
      } else if (mode === 'build') {
        if (e.key === 'Enter' && tileIds.length && !target?.closest('button')) {
          e.preventDefault()
          checkBuild()
        } else if (e.key === 'Backspace' && tileIds.length) {
          e.preventDefault()
          setTileIds((ids) => ids.slice(0, -1))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const complete = (selfGrade?: Grade) => {
    if (done.current) return
    done.current = true
    const spoken = kind === 'spoken' || kind === 'said'
    const grade = finalGrade({
      mode,
      match: spoken ? null : result.grade,
      selfGrade: spoken ? selfGrade : undefined,
      hintUsed,
      attempt,
      ms: answerMs.current,
    })
    onDone({ grade, kind: `response-${kind}`, ms: answerMs.current })
  }

  const own = useOwnValues(lang, qa)
  const template = qa.personal ? form.answers.find(isTemplate) : undefined
  const ownComplete = !!template && Object.values(own).every(Boolean) && Object.keys(own).length > 0
  const matchedAnswer = form.answers[result.index]
  const prefill = kind === 'typed' && matchedAnswer && isTemplate(matchedAnswer) ? captureSlots(typed, matchedAnswer, lang, form.slots) : null
  const shadow =
    template && ownComplete
      ? fillAnswer(template, own)
      : fillAnswer(matchedAnswer && !isTemplate(matchedAnswer) ? matchedAnswer : form.answers[0], displayValues(form, own))

  const modelAnswer = (caption: string) => (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-xs font-medium text-muted-foreground">{caption}</p>
      <TargetText lang={lang} text={shadow.text} latin={shadow.latin} size="md" audio romanization="always" />
      <p className="text-sm text-muted-foreground">{l(shadow.translation)}</p>
    </div>
  )
  const moreAnswers = form.answers.length > 1 || !!template
  const details = moreAnswers ? (
    <>
      {template && <MakeItYours item={qa} form={form} lang={lang} template={template} prefill={prefill} />}
      <ModelAnswers form={form} lang={lang} matchedIndex={result.index} own={own} />
    </>
  ) : undefined
  const detailsLabel = template ? s.moreAnswersPersonal : s.moreAnswers

  const prompt = mode === 'choose' ? s.promptChoose : mode === 'build' ? s.promptBuild : s.answerIn[lang]
  const chosenOption = options.find((o) => o.id === chosen)
  const learnerTone = kind === 'spoken' || kind === 'said' ? 'neutral' : result.grade === 'wrong' ? 'wrong' : 'right'

  return (
    <div className="flex flex-col gap-5">
      <SpeakerBubble lang={lang} label={s.asks(SPEAKERS[lang].name)}>
        {textVisible ? (
          <div className="animate-pop-in">
            <QuestionText
              lang={lang}
              text={form.question.text}
              latin={form.question.latin}
              tokens={form.question.tokens}
              audioUrl={questionAudio}
              romanization={phase === 'feedback' ? 'always' : undefined}
              tapHint={s.tapWord}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              type="button"
              onClick={() => void speak({ lang, text: form.question.text, url: questionAudio })}
              aria-label={s.playQuestion}
              disabled={voiced === null}
              className="relative flex size-20 items-center justify-center rounded-full border-2 border-mod-response/40 bg-mod-response/10 text-mod-response transition hover:scale-105 hover:bg-mod-response/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mod-response/25 disabled:opacity-50 motion-reduce:hover:scale-100"
            >
              <span className="absolute inset-0 rounded-full bg-mod-response/15 motion-safe:animate-ping [animation-iteration-count:2]" aria-hidden />
              <Volume2 className="size-9" />
            </button>
            <span className="text-sm text-muted-foreground">{s.listenFirst}</span>
          </div>
        )}
        {(hintUsed || phase === 'feedback') && (
          <p className="mt-3 animate-pop-in border-t pt-3 text-center text-muted-foreground">
            <span className="sr-only">{s.meaning}: </span>
            {l(qa.question)}
          </p>
        )}
      </SpeakerBubble>

      {phase === 'question' && (
        <div className="-mt-3 flex flex-wrap justify-end gap-1 pe-12">
          {!textVisible && voiced !== null && (
            <Button variant="ghost" size="sm" onClick={() => setTextRevealed(true)}>
              <Eye />
              {s.showText}
            </Button>
          )}
          {!hintUsed && (
            <Button variant="ghost" size="sm" onClick={() => setHintUsed(true)} title={s.translationCost}>
              <Languages />
              {s.showTranslation}
            </Button>
          )}
        </div>
      )}
      {phase === 'question' && voiced === false && <p className="-mt-2 text-center text-xs text-muted-foreground">{s.noVoice}</p>}
      {phase === 'question' && hintUsed && <p className="-mt-2 text-center text-xs text-muted-foreground">{s.translationCost}</p>}

      {phase === 'question' ? (
        <>
          <p className="text-center text-sm font-medium text-muted-foreground">{prompt}</p>

          {mode === 'choose' && (
            <div className="grid grid-cols-1 gap-2.5" role="group" aria-label={prompt}>
              {options.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => answerChoice(o.id)}
                  className="group flex min-h-16 animate-pop-in items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 active:translate-y-0 motion-reduce:hover:translate-y-0"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <kbd className="hidden size-6 shrink-0 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground sm:flex">
                    {i + 1}
                  </kbd>
                  <AnswerLine lang={lang} text={o.text} latin={o.latin} showLatin={romanization === 'always'} className="flex-1" />
                </button>
              ))}
            </div>
          )}

          {mode === 'build' && tiles && (
            <>
              <TileBuilder lang={lang} bank={tiles.bank} chosen={tileIds} onChange={setTileIds} showLatin={romanization === 'always'} />
              <div className={cn(BOTTOM_BAR, 'flex gap-2')}>
                <Button variant="ghost" className="flex-1" onClick={() => setTileIds([])} disabled={!tileIds.length}>
                  {s.clear}
                </Button>
                <Button size="xl" className="flex-[2]" onClick={checkBuild} disabled={!tileIds.length}>
                  {c.actions.check}
                </Button>
              </div>
            </>
          )}

          {mode === 'free' && (
            <div className="space-y-3">
              <div role="tablist" aria-label={s.answerBy} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                {(['type', 'speak'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={via === v}
                    onClick={() => setVia(v)}
                    className={cn(
                      'flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition',
                      via === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {v === 'type' ? <Keyboard className="size-4" /> : <Mic className="size-4" />}
                    {v === 'type' ? s.typeTab : s.speakTab}
                  </button>
                ))}
              </div>

              {via === 'type' ? (
                <>
                  <AnswerInput lang={lang} value={typed} onChange={setTyped} onSubmit={submitTyped} placeholder={s.typePlaceholder} />
                  {dictation.available && (
                    <Button
                      variant="outline"
                      className={cn('w-full', dictation.listening && 'border-mod-response text-mod-response')}
                      onClick={dictation.listening ? dictation.stop : dictation.start}
                      aria-pressed={dictation.listening}
                    >
                      <Mic className={cn(dictation.listening && 'motion-safe:animate-pulse')} />
                      {dictation.listening ? s.dictating : s.dictate}
                    </Button>
                  )}
                  <div className={cn(BOTTOM_BAR, 'flex gap-2')}>
                    <Button variant="ghost" className="flex-1" onClick={() => finish({ grade: 'wrong', index: -1 }, 'typed')}>
                      {s.dontKnow}
                    </Button>
                    <Button size="xl" className="flex-[2]" onClick={submitTyped} disabled={!typed.trim()}>
                      {c.actions.check}
                    </Button>
                  </div>
                </>
              ) : recordingSupported && recorder.state !== 'denied' ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-5">
                  <button
                    type="button"
                    onClick={recorder.state === 'recording' ? recorder.stop : () => void recorder.start()}
                    aria-label={recorder.state === 'recording' ? s.stop : s.record}
                    className={cn(
                      'relative flex size-20 items-center justify-center rounded-full text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-4',
                      recorder.state === 'recording'
                        ? 'bg-destructive focus-visible:ring-destructive/30'
                        : 'bg-mod-response hover:scale-105 focus-visible:ring-mod-response/30 motion-reduce:hover:scale-100',
                    )}
                  >
                    {recorder.state === 'recording' && (
                      <span className="absolute inset-0 rounded-full bg-destructive/40 motion-safe:animate-ping" aria-hidden />
                    )}
                    {recorder.state === 'recording' ? <Square className="relative size-7 fill-current" /> : <Mic className="size-9" />}
                  </button>
                  <span className="text-sm text-muted-foreground" aria-live="polite">
                    {recorder.state === 'recording' ? s.recording : s.record}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center">
                  <Mic className="size-8 text-mod-response" />
                  <p className="font-medium">{recorder.state === 'denied' ? s.micDenied : s.noRecorder}</p>
                  <p className="text-sm text-muted-foreground">{s.sayAloudPrompt}</p>
                  <Button size="xl" className="w-full" onClick={() => finishSpoken('said')}>
                    {s.saidIt}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <LearnerBubble label={s.you} tone={learnerTone}>
            {kind === 'choose' && chosenOption && (
              <div className="flex flex-col items-start gap-0.5">
                <AnswerLine lang={lang} text={chosenOption.text} latin={chosenOption.latin} showLatin={romanization !== 'never'} />
                {!chosenOption.correct && <span className="text-sm italic text-muted-foreground">“{l(chosenOption.translation)}”</span>}
              </div>
            )}
            {kind === 'build' && (
              <AnswerLine
                lang={lang}
                text={selectedTiles.map((t) => t.text).join(' ')}
                latin={selectedTiles.map((t) => t.latin).join(' ')}
                showLatin={romanization !== 'never'}
              />
            )}
            {kind === 'typed' &&
              (typed.trim() ? (
                <span dir="auto" lang={lang} className="font-script text-xl leading-relaxed">
                  {typed}
                </span>
              ) : (
                <span className="italic text-muted-foreground">{s.dontKnow}</span>
              ))}
            {(kind === 'spoken' || kind === 'said') && (
              <span className="flex items-center gap-2 text-sm font-medium">
                <AudioLines className="size-4 text-primary" />
                {kind === 'spoken' && recorder.url ? s.yourRecording : s.saidAloud}
              </span>
            )}
          </LearnerBubble>

          {kind === 'spoken' || kind === 'said' ? (
            <div className="animate-pop-in space-y-4 rounded-2xl border bg-card p-4 sm:p-5" role="status" aria-live="polite">
              <p className="flex items-center gap-2 text-lg font-semibold">
                <AudioLines className="size-6 text-mod-response" />
                {s.compareTitle}
              </p>
              {kind === 'spoken' && recorder.url && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{s.yourRecording}</span>
                  <audio controls src={recorder.url} className="h-10 w-full" />
                </div>
              )}
              {modelAnswer(s.modelAnswer)}
              {details && (
                <Disclosure label={detailsLabel} className="border-t pt-2">
                  {details}
                </Disclosure>
              )}
              <div className="space-y-2">
                <p className="text-center text-sm font-medium">{s.howClose}</p>
                <SelfGrade onGrade={complete} />
              </div>
            </div>
          ) : (
            <FeedbackPanel grade={result.grade} onContinue={() => complete()} details={details} detailsLabel={detailsLabel}>
              {kind === 'typed' && typed.trim() && result.grade !== 'exact' && (
                <p className="text-sm text-muted-foreground">
                  {c.feedback.yourAnswer}: <span dir="auto" className="font-medium text-foreground">{typed}</span>
                </p>
              )}
              {modelAnswer(result.grade === 'wrong' ? c.feedback.expected : s.shadowTitle)}
            </FeedbackPanel>
          )}
        </>
      )}
    </div>
  )
}
