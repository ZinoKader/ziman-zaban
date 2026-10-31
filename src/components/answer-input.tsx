import { Keyboard } from 'lucide-react'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { TargetLang } from '@/content/types'
import { defineStrings } from '@/i18n'
import { isArabicScript } from '@/lib/script/normalize'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { ScriptKeyboard } from './script-keyboard'

const strings = defineStrings({
  en: {
    placeholderTarget: 'Type in Arabic script or Latin letters',
    placeholderBase: 'Type the meaning',
    keyboard: 'On-screen keyboard',
  },
  sv: {
    placeholderTarget: 'Skriv med arabisk skrift eller latinska bokstäver',
    placeholderBase: 'Skriv betydelsen',
    keyboard: 'Tangentbord på skärmen',
  },
})

interface AnswerInputProps {
  /** Target language answers get the script keyboard; base-language answers don't. */
  lang?: TargetLang
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  state?: 'idle' | 'correct' | 'wrong' | 'close'
  placeholder?: string
  autoFocus?: boolean
}

export interface AnswerInputHandle {
  focus: () => void
}

/** Text answer with an optional Sorani/Persian on-screen keyboard. */
export const AnswerInput = forwardRef<AnswerInputHandle, AnswerInputProps>(function AnswerInput(
  { lang, value, onChange, onSubmit, disabled, state = 'idle', placeholder, autoFocus = true },
  ref,
) {
  const s = strings.use()
  const preferArabic = useSettings((st) => st.answerScript === 'arabic')
  const [showKeyboard, setShowKeyboard] = useState(!!lang && preferArabic)
  const input = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }))

  const insert = (text: string) => {
    const el = input.current
    if (!el) return onChange(value + text)
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => el.setSelectionRange(start + text.length, start + text.length))
  }
  const backspace = () => {
    const el = input.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    if (start !== end) return onChange(value.slice(0, start) + value.slice(end))
    if (start === 0) return
    const chars = [...value.slice(0, start)]
    chars.pop()
    const head = chars.join('')
    onChange(head + value.slice(start))
    requestAnimationFrame(() => el?.setSelectionRange(head.length, head.length))
  }

  const arabic = isArabicScript(value)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              onSubmit()
            }
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          dir="auto"
          lang={arabic && lang ? lang : undefined}
          placeholder={placeholder ?? (lang ? s.placeholderTarget : s.placeholderBase)}
          className={cn(
            'h-14 w-full min-w-0 rounded-xl border-2 bg-card px-4 text-lg shadow-xs outline-none transition',
            'focus:border-primary focus:ring-4 focus:ring-primary/15',
            arabic && 'font-script text-2xl',
            state === 'correct' && 'border-success bg-success/5',
            state === 'close' && 'border-warning bg-warning/5',
            state === 'wrong' && 'animate-shake border-destructive bg-destructive/5',
          )}
        />
        {lang && (
          <Button
            type="button"
            variant={showKeyboard ? 'secondary' : 'outline'}
            size="icon-lg"
            className="size-14 rounded-xl"
            onClick={() => setShowKeyboard((v) => !v)}
            aria-label={s.keyboard}
            aria-pressed={showKeyboard}
            disabled={disabled}
          >
            <Keyboard className="size-5" />
          </Button>
        )}
      </div>
      {lang && showKeyboard && !disabled && <ScriptKeyboard lang={lang} onKey={insert} onBackspace={backspace} />}
    </div>
  )
})
