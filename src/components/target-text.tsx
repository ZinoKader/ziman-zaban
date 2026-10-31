import { useState } from 'react'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { useSettings, type RomanizationMode } from '@/store/settings'
import { AudioButton } from './audio-button'
import { RevealScriptButton, useShowScript } from './script-toggle'

/** The leading line, whichever script it is in. */
const SIZES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl sm:text-4xl',
  xl: 'text-4xl sm:text-5xl',
  '2xl': 'text-5xl sm:text-6xl',
} as const

/** Arabic script under a leading romanization: about 60% of the leading size, never too small to read. */
const SCRIPT_SECONDARY = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg sm:text-xl',
  xl: 'text-2xl sm:text-3xl',
  '2xl': 'text-3xl sm:text-4xl',
} as const

/** Romanization under leading Arabic script. */
const LATIN_SECONDARY = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
  '2xl': 'text-xl',
} as const

/** Sizes big enough to carry their own "show script" link; smaller text follows the global setting only. */
const BIG = new Set<keyof typeof SIZES>(['lg', 'xl', '2xl'])

export type TargetTextLead = 'latin' | 'script'

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
  /**
   * Which line leads when both are shown. Defaults to the romanization, except for learners who
   * turned romanization off: for them the script stays primary even where it is forced on.
   */
  lead?: TargetTextLead
  align?: 'start' | 'center'
  className?: string
}

/** Sorani or Persian text with romanization and audio according to the user's settings. */
export function TargetText({
  lang,
  text,
  latin,
  size = 'md',
  audioUrl,
  audio = false,
  autoPlay = false,
  romanization,
  lead,
  align = 'center',
  className,
}: TargetTextProps) {
  const setting = useSettings((s) => s.romanization)
  const mode = romanization ?? setting
  const [revealed, setRevealed] = useState(false)
  const [scriptOpen, setScriptOpen] = useState(false)
  const showScript = useShowScript()
  const s = common.use()

  const latinShown = !!latin && (mode === 'always' || (mode === 'tap' && revealed))
  const latinLeads = latinShown && (lead ?? (setting === 'never' ? 'script' : 'latin')) === 'latin'
  const center = align === 'center'

  const script = (primary: boolean) => (
    <span
      dir="rtl"
      lang={lang}
      data-role={primary ? 'primary' : 'secondary'}
      className={cn(
        'font-script text-balance',
        primary ? cn('font-medium leading-[1.6]', SIZES[size]) : cn('leading-[1.7] text-foreground/75', SCRIPT_SECONDARY[size]),
      )}
    >
      {text}
    </span>
  )

  const romanized = (primary: boolean) => (
    <span
      dir="ltr"
      lang={`${lang}-Latn`}
      data-role={primary ? 'primary' : 'secondary'}
      className={cn(
        'text-balance',
        primary ? cn('font-bold leading-tight tracking-tight', SIZES[size]) : cn('font-medium tracking-wide text-muted-foreground', LATIN_SECONDARY[size]),
      )}
    >
      {latin}
    </span>
  )

  return (
    <div className={cn('flex flex-col', latinLeads ? 'gap-0.5' : 'gap-1', center ? 'items-center text-center' : 'items-start', className)}>
      <div className={cn('flex items-center gap-2', center && 'justify-center')}>
        {latinLeads ? romanized(true) : script(true)}
        {audio && <AudioButton lang={lang} text={text} url={audioUrl} autoPlay={autoPlay} />}
      </div>
      {latinShown && !latinLeads && romanized(false)}
      {latinLeads && (showScript || scriptOpen) && script(false)}
      {latinLeads && !showScript && !scriptOpen && BIG.has(size) && (
        <RevealScriptButton onClick={() => setScriptOpen(true)} />
      )}
      {latin && mode === 'tap' && !revealed && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className={cn('rounded-md px-2 italic text-muted-foreground opacity-70 transition hover:bg-muted', LATIN_SECONDARY[size])}
          aria-label={s.tapToReveal}
        >
          • • •
        </button>
      )}
    </div>
  )
}
