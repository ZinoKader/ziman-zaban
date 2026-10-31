import { useState } from 'react'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { useSettings, type RomanizationMode } from '@/store/settings'
import { AudioButton } from './audio-button'

const SIZES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl sm:text-4xl',
  xl: 'text-4xl sm:text-5xl',
  '2xl': 'text-5xl sm:text-6xl',
} as const

const LATIN_SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
  '2xl': 'text-xl',
} as const

export interface TargetTextProps {
  lang: TargetLang
  text: string
  latin?: string
  size?: keyof typeof SIZES
  /** Recorded audio. Without it, the browser voice is used when available. */
  audioUrl?: string
  audio?: boolean
  autoPlay?: boolean
  /** Overrides the user's romanization setting (e.g. always show it in feedback). */
  romanization?: RomanizationMode
  align?: 'start' | 'center'
  className?: string
}

/** Sorani or Persian text, right-to-left, with romanization and audio according to the user's settings. */
export function TargetText({
  lang,
  text,
  latin,
  size = 'md',
  audioUrl,
  audio = false,
  autoPlay = false,
  romanization,
  align = 'center',
  className,
}: TargetTextProps) {
  const setting = useSettings((s) => s.romanization)
  const mode = romanization ?? setting
  const [revealed, setRevealed] = useState(false)
  const s = common.use()

  return (
    <div className={cn('flex flex-col gap-1', align === 'center' ? 'items-center text-center' : 'items-start', className)}>
      <div className={cn('flex items-center gap-2', align === 'center' && 'justify-center')}>
        <span dir="rtl" lang={lang} className={cn('font-script font-medium leading-[1.6] text-balance', SIZES[size])}>
          {text}
        </span>
        {audio && <AudioButton lang={lang} text={text} url={audioUrl} autoPlay={autoPlay} />}
      </div>
      {latin && mode === 'always' && (
        <span lang={`${lang}-Latn`} className={cn('font-medium tracking-wide text-muted-foreground', LATIN_SIZES[size])}>
          {latin}
        </span>
      )}
      {latin && mode === 'tap' && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className={cn(
            'rounded-md px-2 text-muted-foreground transition hover:bg-muted',
            LATIN_SIZES[size],
            !revealed && 'italic opacity-70',
          )}
          aria-label={s.tapToReveal}
        >
          {revealed ? latin : '• • •'}
        </button>
      )}
    </div>
  )
}
