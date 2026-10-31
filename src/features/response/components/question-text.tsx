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

/** The question, with every word tappable to show its gloss. */
export function QuestionText({ lang, text, latin, tokens, audioUrl, romanization, tapHint }: QuestionTextProps) {
  const l = useLocalize()
  const setting = useSettings((s) => s.romanization)
  const mode = romanization ?? setting
  const [latinShown, setLatinShown] = useState(false)
  const c = common.use()

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="flex items-center justify-center gap-2">
        <p dir="rtl" lang={lang} className="font-script text-3xl font-medium leading-[1.7] text-balance sm:text-4xl" title={tokens?.length ? tapHint : undefined}>
          {tokens?.length
            ? tokens.map((t, i) => (
                <span key={i}>
                  {i > 0 && ' '}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="rounded-lg px-0.5 underline decoration-muted-foreground/30 decoration-dotted underline-offset-[10px] transition hover:bg-mod-response/10 hover:decoration-mod-response focus-visible:bg-mod-response/10 focus-visible:outline-none data-[state=open]:bg-mod-response/15"
                      >
                        {t.text}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" className="w-auto min-w-40 max-w-64 items-center text-center">
                      <span dir="rtl" lang={lang} className="font-script text-2xl leading-relaxed">
                        {t.text}
                      </span>
                      <span lang={`${lang}-Latn`} className="text-sm text-muted-foreground">
                        {t.latin}
                      </span>
                      <span className="text-base font-medium">{l(t.gloss)}</span>
                      {t.morph && <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{t.morph}</code>}
                    </PopoverContent>
                  </Popover>
                </span>
              ))
            : text}
        </p>
        <AudioButton lang={lang} text={text} url={audioUrl} />
      </div>
      {mode === 'always' && (
        <span lang={`${lang}-Latn`} className="text-base font-medium tracking-wide text-muted-foreground">
          {latin}
        </span>
      )}
      {mode === 'tap' && (
        <button
          type="button"
          onClick={() => setLatinShown((v) => !v)}
          className={cn('rounded-md px-2 text-base text-muted-foreground transition hover:bg-muted', !latinShown && 'italic opacity-70')}
          aria-label={c.tapToReveal}
        >
          {latinShown ? latin : '• • •'}
        </button>
      )}
    </div>
  )
}
