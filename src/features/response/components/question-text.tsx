import { useState } from 'react'
import { AudioButton } from '@/components/audio-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { TargetLang, Token } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { useSettings, type RomanizationMode } from '@/store/settings'

interface QuestionTextProps {
  lang: TargetLang
  text: string
  latin: string
  tokens?: Token[]
  audioUrl?: string
  romanization?: RomanizationMode
  tapHint: string
}

/**
 * The question, with every word of the leading line tappable to show its gloss. Like `TargetText`,
 * the romanization leads when it is shown; the script leads for learners who turned it off.
 */
export function QuestionText({ lang, text, latin, tokens, audioUrl, romanization, tapHint }: QuestionTextProps) {
  const l = useLocalize()
  const setting = useSettings((s) => s.romanization)
  const mode = romanization ?? setting
  const [revealed, setRevealed] = useState(false)
  const c = common.use()
  const latinShown = mode === 'always' || (mode === 'tap' && revealed)
  const latinLeads = latinShown && setting !== 'never'

  const words = (which: 'latin' | 'script') =>
    tokens?.length
      ? tokens.map((t, i) => (
          <span key={i}>
            {i > 0 && ' '}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'rounded-lg px-0.5 underline decoration-muted-foreground/30 decoration-dotted transition hover:bg-mod-response/10 hover:decoration-mod-response focus-visible:bg-mod-response/10 focus-visible:outline-none data-[state=open]:bg-mod-response/15',
                    which === 'latin' ? 'underline-offset-[6px]' : 'underline-offset-[10px]',
                  )}
                >
                  {which === 'latin' ? t.latin : t.text}
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-auto min-w-40 max-w-64 items-center text-center">
                <span lang={`${lang}-Latn`} className="text-lg font-semibold">
                  {t.latin}
                </span>
                <span dir="rtl" lang={lang} className="font-script text-xl leading-relaxed text-foreground/80">
                  {t.text}
                </span>
                <span className="text-base font-medium">{l(t.gloss)}</span>
                {t.morph && <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{t.morph}</code>}
              </PopoverContent>
            </Popover>
          </span>
        ))
      : which === 'latin'
        ? latin
        : text

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="flex items-center justify-center gap-2">
        {latinLeads ? (
          <p dir="ltr" lang={`${lang}-Latn`} className="text-2xl font-bold leading-snug text-balance sm:text-3xl" title={tokens?.length ? tapHint : undefined}>
            {words('latin')}
          </p>
        ) : (
          <p dir="rtl" lang={lang} className="font-script text-3xl font-medium leading-[1.7] text-balance sm:text-4xl" title={tokens?.length ? tapHint : undefined}>
            {words('script')}
          </p>
        )}
        <AudioButton lang={lang} text={text} url={audioUrl} />
      </div>
      {latinShown &&
        (latinLeads ? (
          <p dir="rtl" lang={lang} className="font-script text-xl leading-[1.7] text-foreground/75 sm:text-2xl">
            {text}
          </p>
        ) : (
          <span lang={`${lang}-Latn`} className="text-base font-medium tracking-wide text-muted-foreground">
            {latin}
          </span>
        ))}
      {!latinShown && mode === 'tap' && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-md px-2 text-base italic text-muted-foreground opacity-70 transition hover:bg-muted"
          aria-label={c.tapToReveal}
        >
          • • •
        </button>
      )}
    </div>
  )
}
