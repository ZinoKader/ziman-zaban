import type { Form, TargetLang } from '@/content/types'
import { cn } from '@/lib/utils'
import { hintView, type AnswerScript } from '../hints'
import { recallStrings } from '../strings'

interface HintMaskProps {
  form: Form
  lang: TargetLang
  script: AnswerScript
  level: number
}

/** Letter boxes for the hidden answer: the first letters filled in, the rest blank. */
export function HintMask({ form, lang, script, level }: HintMaskProps) {
  const s = recallStrings.use()
  const { slots, shown, total } = hintView(form, script, level)
  const arabic = script === 'arabic'
  return (
    <div className="flex animate-pop-in flex-col items-center gap-2" role="note" aria-label={s.hintAria(shown, total)}>
      <div
        dir={arabic ? 'rtl' : 'ltr'}
        lang={arabic ? lang : `${lang}-Latn`}
        className="flex flex-wrap items-end justify-center gap-1"
        aria-hidden
      >
        {slots.map((slot, i) =>
          slot.kind === 'gap' ? (
            <span key={i} className="w-3" />
          ) : (
            <span
              key={i}
              className={cn(
                'flex h-10 w-8 items-center justify-center rounded-lg border-b-2 transition',
                arabic ? 'font-script text-2xl' : 'text-lg font-semibold',
                slot.revealed ? 'border-mod-recall bg-mod-recall/15 text-foreground' : 'border-muted-foreground/40 bg-muted/60',
              )}
            >
              {slot.revealed ? slot.text : ''}
            </span>
          ),
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {s.letters(total)} · {s.hintCost}
      </p>
    </div>
  )
}
