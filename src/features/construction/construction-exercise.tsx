import { Eye, EyeOff, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnswerInput } from '@/components/answer-input'
import { AudioButton } from '@/components/audio-button'
import { FeedbackPanel } from '@/components/feedback-panel'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { evidenceFor, sentenceById, sentencesFor } from '@/content'
import type { Sentence, SentenceForm, TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { seededRandom } from '@/lib/distractors'
import { matchTargetAnswer, type MatchGrade } from '@/lib/script/match'
import { isArabicScript } from '@/lib/script/normalize'
import { gradeOutcome, Rating } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import type { ExerciseProps } from '../session/types'
import { PlacedReview, Shadowing, TokenDiff } from './feedback-parts'
import { GrammarChips } from './grammar-chips'
import {
  acceptedSequences,
  buildTiles,
  checkTiles,
  checkTyped,
  chooseMode,
  clozeForms,
  pickClozeIndex,
  stripPunct,
  tileStatuses,
  type Mode,
  type TileStatus,
  type TypedCheck,
} from './logic'
import { SentenceBreakdown } from './sentence-breakdown'
import { constructionStrings } from './strings'
import { WordTile } from './word-tile'
import { useShowScript } from '@/components/script-toggle'

interface Result {
  grade: MatchGrade
  ms: number
  /** One tile or word off: graded Hard rather than Again. */
  oneOff: boolean
  /** The learner produced an accepted version other than the canonical one. */
  usedVersion?: 'alternative' | 'colloquial'
  statuses?: TileStatus[]
  typed?: TypedCheck
}

/** Under this time (ms) a correct answer counts as effortless and may earn Easy. */
function fastMs(mode: Mode, words: number): number {
  if (mode === 'bank') return 1500 + 1500 * words
  if (mode === 'cloze') return 4000
  return 3000 + 2500 * words
}

const TRAILING_PUNCT = /[.,!?;:،؛؟»"…]+$/

export function ConstructionExercise({ item, lang, attempt, onDone }: ExerciseProps) {
  const sentence = sentenceById.get(item.itemId)
  if (!sentence?.[lang]) return null
  return <ConstructionInner sentence={sentence} item={item} lang={lang} attempt={attempt} onDone={onDone} />
}

function ConstructionInner({ sentence, item, lang, attempt, onDone }: ExerciseProps & { sentence: Sentence }) {
  const s = constructionStrings.use()
  const c = common.use()
  const l = useLocalize()
  const romanization = useSettings((st) => st.romanization)
  const form = sentence[lang]!
  const audioUrl = evidenceFor('sentence', lang, sentence.id).audio

  const firstExposure = !item.card && attempt === 0
  const [mode] = useState<Mode>(() => (firstExposure ? 'bank' : chooseMode(item.card, attempt)))
  const [phase, setPhase] = useState<'intro' | 'question' | 'feedback'>(firstExposure ? 'intro' : 'question')
  const [placed, setPlaced] = useState<number[]>([])
  const [typed, setTyped] = useState('')
  const [showLatin, setShowLatin] = useState(romanization === 'always')
  const [result, setResult] = useState<Result | null>(null)
  const shownAt = useRef(Date.now())

  const tiles = useMemo(
    () => buildTiles(sentence, lang, seededRandom(`${item.key}:${attempt}:tiles`), sentencesFor(lang)),
    [sentence, lang, item.key, attempt],
  )
  const tileById = useMemo(() => new Map(tiles.map((t) => [t.id, t])), [tiles])
  const clozeIndex = useMemo(
    () => pickClozeIndex(form.tokens, seededRandom(`${item.key}:${attempt}:cloze`)),
    [form.tokens, item.key, attempt],
  )

  useEffect(() => {
    if (phase === 'question') shownAt.current = Date.now()
  }, [phase])

  const finish = (r: Omit<Result, 'ms'>) => {
    setResult({ ...r, ms: Date.now() - shownAt.current })
    setPhase('feedback')
  }

  const place = (id: number) => {
    if (phase !== 'question' || placed.includes(id)) return
    setPlaced((p) => [...p, id])
  }
  const unplace = (id: number) => phase === 'question' && setPlaced((p) => p.filter((x) => x !== id))

  const checkBank = () => {
    if (phase !== 'question' || !placed.length) return
    const texts = placed.map((id) => tileById.get(id)!.text)
    const r = checkTiles(texts, form, lang)
    finish({
      grade: r.result === 'correct' ? 'exact' : r.result === 'near' ? 'typo' : 'wrong',
      oneOff: r.result === 'near',
      usedVersion: r.result === 'correct' && r.matched > 0 ? 'alternative' : undefined,
      statuses: tileStatuses(texts, acceptedSequences(form)[r.matched], lang),
    })
  }

  const checkCloze = () => {
    if (!typed.trim()) return
    const m = matchTargetAnswer(typed, clozeForms(form, clozeIndex, lang), lang)
    finish({ grade: m.grade, oneOff: false })
  }

  const checkFull = () => {
    if (!typed.trim()) return
    const r = checkTyped(typed, form, lang)
    const usedVersion = r.grade !== 'wrong' && !r.oneWordOff && r.version.kind !== 'canonical' ? r.version.kind : undefined
    finish({ grade: r.grade, oneOff: r.oneWordOff, usedVersion, typed: r })
  }

  useEffect(() => {
    if (phase !== 'question' || mode !== 'bank') return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) {
        const n = e.key === '0' ? 10 : Number(e.key)
        const tile = tiles[n - 1]
        if (tile) {
          e.preventDefault()
          place(tile.id)
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPlaced((p) => p.slice(0, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        checkBank()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const complete = () => {
    if (!result) return
    let grade = gradeOutcome({
      match: result.grade,
      hintsUsed: 0,
      attempts: 1,
      responseMs: result.ms,
      fastMs: fastMs(mode, form.tokens.length),
    })
    // Right after seeing the model, or after missing it earlier in the session, success says little about long-term memory.
    if (grade === Rating.Easy && (firstExposure || attempt > 0)) grade = Rating.Good
    onDone({ grade, kind: firstExposure ? 'construction-intro' : `construction-${mode}`, ms: result.ms })
  }

  if (phase === 'intro') {
    return (
      <div className="flex flex-col gap-5 animate-pop-in">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-mod-construction">{s.newSentence}</p>
        <div className="space-y-5 rounded-3xl border bg-card px-4 py-6 shadow-sm sm:px-6">
          <p className="text-center text-xl font-semibold text-balance">{l(sentence.translation)}</p>
          <div className="space-y-2">
            <TargetText lang={lang} text={form.text} latin={form.latin} size="lg" audio audioUrl={audioUrl} autoPlay />
          </div>
          <SentenceBreakdown lang={lang} tokens={form.tokens} />
          {!!form.grammar?.length && <GrammarChips ids={form.grammar} />}
        </div>
        <p className="text-center text-sm text-muted-foreground">{s.study}</p>
        <Button size="xl" onClick={() => setPhase('question')} autoFocus>
          {s.buildIt}
        </Button>
      </div>
    )
  }

  const prompt = mode === 'bank' ? s.buildPrompt[lang] : mode === 'cloze' ? s.clozePrompt : s.typedPrompt[lang]
  const latinToggle = romanization === 'tap' && phase === 'question' && mode !== 'typed' && (
    <Button variant="ghost" size="sm" className="self-center text-muted-foreground" onClick={() => setShowLatin((v) => !v)} aria-pressed={showLatin}>
      {showLatin ? <EyeOff /> : <Eye />} {showLatin ? s.hideLatin : s.showLatin}
    </Button>
  )
  const latinVisible = romanization !== 'never' && (showLatin || phase === 'feedback')
  // Tiles follow the reading direction of their leading line.
  const flow = latinVisible ? 'ltr' : 'rtl'

  return (
    <div className="flex flex-col gap-5">
      <p className="text-center text-sm font-medium text-muted-foreground">{prompt}</p>

      <div className="flex min-h-32 flex-col items-center justify-center gap-4 rounded-3xl border bg-card px-4 py-7 shadow-sm">
        {mode === 'cloze' ? (
          <>
            <p className="text-center text-muted-foreground">{l(sentence.translation)}</p>
            <ClozeSentence
              lang={lang}
              form={form}
              index={clozeIndex}
              typed={typed}
              revealed={phase === 'feedback'}
              showLatin={latinVisible}
            />
            <p className="text-sm text-muted-foreground">
              {s.meaningHint}: <span className="font-medium text-foreground">{l(form.tokens[clozeIndex].gloss)}</span>
            </p>
          </>
        ) : (
          <p className="text-center text-2xl font-semibold text-balance sm:text-3xl">{l(sentence.translation)}</p>
        )}
      </div>

      {mode === 'bank' &&
        (phase === 'feedback' && result?.statuses ? (
          <div className="rounded-2xl border-2 border-transparent p-3">
            <PlacedReview
              lang={lang}
              tiles={placed.map((id) => tileById.get(id)!)}
              statuses={result.statuses}
              showLatin={latinVisible}
            />
          </div>
        ) : (
          <>
            <div
              dir={flow}
              role="list"
              aria-label={s.answerLine}
              className={cn(
                'relative flex min-h-28 flex-wrap content-start items-start justify-center gap-2 rounded-2xl border-2 border-dashed p-3 transition-colors',
                placed.length ? 'border-primary/30 bg-primary/[0.03]' : 'border-border bg-muted/30',
              )}
            >
              {placed.length === 0 && (
                <p dir="auto" className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  {s.tapTiles}
                </p>
              )}
              {placed.map((id) => {
                const t = tileById.get(id)!
                return (
                  <div role="listitem" key={id} className="animate-pop-in">
                    <WordTile
                      lang={lang}
                      text={t.text}
                      latin={t.latin}
                      showLatin={latinVisible}
                      state="placed"
                      label={s.removeWord(stripPunct(t.text))}
                      onClick={() => unplace(id)}
                    />
                  </div>
                )
              })}
            </div>

            <div dir={flow} role="group" aria-label={s.wordBank} className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
              {tiles.map((t, i) => (
                <WordTile
                  key={t.id}
                  lang={lang}
                  text={t.text}
                  latin={t.latin}
                  showLatin={latinVisible}
                  state={placed.includes(t.id) ? 'used' : 'idle'}
                  shortcut={i < 10 ? (i + 1) % 10 : undefined}
                  label={s.addWord(stripPunct(t.text))}
                  onClick={() => place(t.id)}
                />
              ))}
            </div>
            {latinToggle}

            <p className="hidden items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex sm:flex-wrap">
              <span className="flex items-center gap-1">
                <Kbd>1</Kbd>–<Kbd>{Math.min(tiles.length, 10) % 10}</Kbd> {s.keys.pick}
              </span>
              <span className="flex items-center gap-1">
                <Kbd>⌫</Kbd> {s.keys.undo}
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Enter</Kbd> {s.keys.check}
              </span>
            </p>

            <div className="sticky bottom-0 z-10 -mx-4 flex gap-2 bg-linear-to-t from-background from-70% to-transparent px-4 pt-4 pb-safe sm:static sm:mx-0 sm:bg-none sm:p-0">
              <Button variant="outline" size="xl" onClick={() => setPlaced([])} disabled={!placed.length} aria-label={s.clear}>
                <RotateCcw />
              </Button>
              <Button size="xl" className="flex-1" onClick={checkBank} disabled={!placed.length}>
                {c.actions.check}
              </Button>
            </div>
          </>
        ))}

      {mode !== 'bank' && phase === 'question' && (
        <div className="space-y-2">
          {latinToggle}
          <AnswerInput
            lang={lang}
            value={typed}
            onChange={setTyped}
            onSubmit={mode === 'cloze' ? checkCloze : checkFull}
            placeholder={mode === 'cloze' ? s.typeWord : s.typeSentence}
          />
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => finish({ grade: 'wrong', oneOff: false })}>
              {s.dontKnow}
            </Button>
            <Button size="lg" className="flex-1" onClick={mode === 'cloze' ? checkCloze : checkFull} disabled={!typed.trim()}>
              {c.actions.check}
            </Button>
          </div>
        </div>
      )}

      {phase === 'feedback' && result && (
        <FeedbackPanel
          grade={result.grade}
          onContinue={complete}
          detailsLabel={c.feedback.more.sentence}
          details={
            <>
              {form.colloquial && <SpokenLine lang={lang} colloquial={form.colloquial} />}
              {!!form.alternatives?.length && (
                <div className="space-y-0.5">
                  {form.alternatives.map((a) => (
                    <AsideLine key={a.text} label={s.alsoCorrect} lang={lang} text={a.text} latin={a.latin} />
                  ))}
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{s.wordByWord}</p>
                <SentenceBreakdown lang={lang} tokens={form.tokens} highlight={mode === 'cloze' ? [clozeIndex] : []} />
              </div>
              <GrammarChips ids={form.grammar} />
              {result.grade !== 'wrong' && <Shadowing lang={lang} text={form.text} url={audioUrl} />}
            </>
          }
        >
          {result.oneOff && <p className="font-medium">{s.oneOff}</p>}
          {mode === 'cloze' && typed && result.grade !== 'exact' && (
            <p className="text-sm text-muted-foreground">
              {c.feedback.yourAnswer}:{' '}
              <span dir="auto" lang={lang} className="font-medium text-foreground">
                {typed}
              </span>
            </p>
          )}
          {mode === 'typed' && result.typed && typed && (result.grade === 'wrong' || result.grade === 'typo') && (
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">{c.feedback.yourAnswer}:</p>
              <TokenDiff lang={lang} ops={result.typed.diff} script={result.typed.inputScript} />
            </div>
          )}
          {result.usedVersion && (
            <p className="text-sm">{result.usedVersion === 'colloquial' ? s.youUsedSpoken : s.yourVersion}</p>
          )}

          <div className="space-y-2 pt-1">
            {result.grade !== 'exact' && <p className="text-center text-xs font-medium text-muted-foreground">{c.feedback.expected}</p>}
            <TargetText lang={lang} text={form.text} latin={form.latin} size="md" audio audioUrl={audioUrl} autoPlay romanization="always" />
            <p className="text-center text-muted-foreground">{l(sentence.translation)}</p>
          </div>
        </FeedbackPanel>
      )}
    </div>
  )
}

/** A spoken form or another accepted version, as a small aside that never competes with the sentence itself. */
function AsideLine({ label, title, lang, text, latin }: { label: string; title?: string; lang: TargetLang; text: string; latin: string }) {
  const romanization = useSettings((st) => st.romanization)
  const showScript = useShowScript()
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-muted-foreground" title={title}>
      <span>{label}</span>
      <span aria-hidden>·</span>
      {romanization !== 'never' && (
        <span lang={`${lang}-Latn`} className="font-medium text-foreground/80">
          {latin}
        </span>
      )}
      {showScript && (
        <span dir="rtl" lang={lang} className="font-script">
          {text}
        </span>
      )}
      <AudioButton lang={lang} text={text} className="size-7 [&_svg]:size-3.5" />
    </p>
  )
}

function SpokenLine({ lang, colloquial }: { lang: TargetLang; colloquial: NonNullable<SentenceForm['colloquial']> }) {
  const s = constructionStrings.use()
  return <AsideLine label={s.spoken} title={s.spokenNote} lang={lang} text={colloquial.text} latin={colloquial.latin} />
}

function Blank({ fill, revealed }: { fill: string; revealed: boolean }) {
  const s = constructionStrings.use()
  return (
    <span
      aria-label={s.blank}
      dir="auto"
      className={cn(
        'inline-flex min-w-16 justify-center border-b-[3px] px-2 motion-safe:transition-colors',
        revealed ? 'border-success text-success animate-pop-in' : 'border-primary text-primary',
      )}
    >
      {fill || '\u00A0'}
    </span>
  )
}

/** The sentence with one word blanked out; the learner's answer fills the line in the script they type in. */
function ClozeSentence({
  lang,
  form,
  index,
  typed,
  revealed,
  showLatin,
}: {
  lang: TargetLang
  form: SentenceForm
  index: number
  typed: string
  /** After checking the blank shows the correct word. */
  revealed: boolean
  showLatin: boolean
}) {
  const tail = (t: string) => TRAILING_PUNCT.exec(t)?.[0] ?? ''
  const typedArabic = isArabicScript(typed)
  const token = form.tokens[index]
  const scriptFill = revealed ? stripPunct(token.text) : typedArabic || !showLatin ? typed : ''
  const latinFill = revealed ? stripPunct(token.latin) : typedArabic ? '' : typed

  const scriptLine = (primary: boolean) => (
    <p
      dir="rtl"
      lang={lang}
      className={cn(
        'flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-2 font-script',
        primary ? 'text-3xl font-medium leading-[1.8] sm:text-4xl' : 'text-xl leading-[1.8] text-foreground/75 sm:text-2xl',
      )}
    >
      {form.tokens.map((t, i) =>
        i === index ? (
          <span key={i} className="inline-flex items-baseline">
            <Blank fill={scriptFill} revealed={revealed} />
            {tail(t.text)}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        ),
      )}
    </p>
  )

  if (!showLatin) return <div className="flex flex-col items-center gap-1">{scriptLine(true)}</div>
  return (
    <div className="flex flex-col items-center gap-1">
      <p
        dir="ltr"
        lang={`${lang}-Latn`}
        className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-2 text-2xl font-bold leading-snug sm:text-3xl"
      >
        {form.tokens.map((t, i) =>
          i === index ? (
            <span key={i} className="inline-flex items-baseline">
              <Blank fill={latinFill} revealed={revealed} />
              {tail(t.latin)}
            </span>
          ) : (
            <span key={i}>{t.latin}</span>
          ),
        )}
      </p>
      {scriptLine(false)}
    </div>
  )
}
