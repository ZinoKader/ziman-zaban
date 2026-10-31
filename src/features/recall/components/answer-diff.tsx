import type { Form, TargetLang } from '@/content/types'
import { ZWNJ } from '@/lib/script/normalize'
import { cn } from '@/lib/utils'
import { diffChars, diffSimilarity, joinsNext, type DiffOp, type DiffOpType } from '../diff'
import { diffPair } from '../grading'
import { recallStrings } from '../strings'

/** Below this share of matching letters a diff is just noise; the answer is shown plainly instead. */
const MIN_SIMILARITY = 0.34
const ZWJ = '\u200D'

const TONE: Record<DiffOpType, string> = {
  equal: '',
  extra: 'rounded-sm bg-destructive/15 text-destructive line-through decoration-2',
  missing: 'rounded-sm bg-success/20 text-success underline decoration-2 underline-offset-4',
}

/** Changed characters get their own span so each can be marked; unchanged runs stay together. */
function segments(ops: DiffOp[]): DiffOp[] {
  return ops.flatMap((op) => (op.type === 'equal' ? [op] : [...op.text].map((ch) => ({ type: op.type, text: ch }))))
}

interface AnswerDiffProps {
  input: string
  form: Form
  lang: TargetLang
  className?: string
}

/** The learner's answer with what was wrong (struck out) and what was missing (inserted) marked. */
export function AnswerDiff({ input, form, lang, className }: AnswerDiffProps) {
  const s = recallStrings.use()
  const { answer, expected, script } = diffPair(input, form, lang)
  const ops = diffChars(answer, expected)
  const differs = ops.some((o) => o.type !== 'equal')
  const useful = differs && diffSimilarity(ops) >= MIN_SIMILARITY
  const textProps =
    script === 'arabic'
      ? { dir: 'rtl' as const, lang, className: 'font-script text-2xl leading-[1.8]' }
      : { dir: 'ltr' as const, lang: `${lang}-Latn`, className: 'text-lg font-medium tracking-wide' }

  const segs = segments(ops)
  const first = (i: number) => (segs[i] ? [...segs[i].text][0] : undefined)
  const last = (i: number) => (segs[i] ? [...segs[i].text].at(-1) : undefined)

  return (
    <div className={cn('space-y-1', className)}>
      <p {...textProps} className={cn(textProps.className, 'break-words')} data-testid="answer-diff">
        {useful ? (
          segs.map((seg, i) => {
            const invisible = seg.type !== 'equal' && (seg.text === ZWNJ || seg.text === ' ')
            if (invisible) {
              const label = seg.text === ZWNJ ? s.halfSpace : s.space
              return (
                <span
                  key={i}
                  role="img"
                  aria-label={label}
                  title={label}
                  className={cn('mx-px inline-block h-[0.9em] align-middle', seg.text === ZWNJ ? 'w-1' : 'w-2.5', TONE[seg.type], 'no-underline')}
                />
              )
            }
            // Keeps letters in their connected shapes across differently coloured spans.
            const before = script === 'arabic' && joinsNext(last(i - 1), first(i)) ? ZWJ : ''
            const after = script === 'arabic' && joinsNext(last(i), first(i + 1)) ? ZWJ : ''
            return (
              <span key={i} className={TONE[seg.type]}>
                {before + seg.text + after}
              </span>
            )
          })
        ) : (
          <span className={cn(differs && TONE.extra)}>{answer}</span>
        )}
      </p>
      {useful && <p className="text-xs text-muted-foreground">{s.diffLegend}</p>}
    </div>
  )
}
