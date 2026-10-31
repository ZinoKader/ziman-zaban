import { Delete, Space } from 'lucide-react'
import type { TargetLang } from '@/content/types'
import { cn } from '@/lib/utils'
import { ZWNJ } from '@/lib/script/normalize'

/*
 * Letters in alphabetical order rather than a typewriter layout: learners
 * usually don't know either layout, and alphabetical order teaches the alphabet.
 * The Sorani set is the 33 letters of the Kurdish Unified Keyboard; Persian is the
 * 32-letter alphabet plus آ and hamza forms.
 */
export const KEYBOARD_ROWS: Record<TargetLang, string[][]> = {
  ckb: [
    ['ئ', 'ا', 'ب', 'پ', 'ت', 'ج', 'چ', 'ح', 'خ', 'د', 'ر'],
    ['ڕ', 'ز', 'ژ', 'س', 'ش', 'ع', 'غ', 'ف', 'ڤ', 'ق', 'ک'],
    ['گ', 'ل', 'ڵ', 'م', 'ن', 'ه', 'ە', 'و', 'ۆ', 'ی', 'ێ'],
  ],
  fa: [
    ['آ', 'ا', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د'],
    ['ذ', 'ر', 'ز', 'ژ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع'],
    ['غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن', 'و', 'ه', 'ی'],
  ],
}

const EXTRA: Record<TargetLang, string[]> = {
  ckb: ['؟', '،'],
  fa: ['ء', 'ئ', '؟', '،'],
}

interface ScriptKeyboardProps {
  lang: TargetLang
  onKey: (text: string) => void
  onBackspace: () => void
  className?: string
}

export function ScriptKeyboard({ lang, onKey, onBackspace, className }: ScriptKeyboardProps) {
  const key = 'flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg border bg-card text-xl shadow-xs transition active:scale-95 active:bg-accent sm:h-12'
  return (
    <div
      className={cn('select-none space-y-1.5 rounded-2xl border bg-muted/60 p-2', className)}
      dir="rtl"
      lang={lang}
      onMouseDown={(e) => e.preventDefault()}
    >
      {KEYBOARD_ROWS[lang].map((row, i) => (
        <div key={i} className="flex gap-1">
          {row.map((ch) => (
            <button key={ch} type="button" className={cn(key, 'font-script')} onClick={() => onKey(ch)}>
              {ch}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-1">
        {EXTRA[lang].map((ch) => (
          <button key={ch} type="button" className={cn(key, 'max-w-12 font-script')} onClick={() => onKey(ch)}>
            {ch}
          </button>
        ))}
        <button type="button" className={cn(key, 'max-w-20 text-xs')} onClick={() => onKey(ZWNJ)} title="Zero-width non-joiner (half space)">
          ‌نیم‌فاصله
        </button>
        <button type="button" className={cn(key, 'flex-[3]')} onClick={() => onKey(' ')} aria-label="space">
          <Space className="size-5" />
        </button>
        <button type="button" className={cn(key, 'max-w-16')} onClick={onBackspace} aria-label="backspace">
          <Delete className="size-5" />
        </button>
      </div>
    </div>
  )
}
