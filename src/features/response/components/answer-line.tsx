import type { TargetLang } from '@/content/types'
import { cn } from '@/lib/utils'

/** An answer in a list or bubble: romanization first when shown, the script under it. */
export function AnswerLine({
  lang,
  text,
  latin,
  showLatin,
  className,
}: {
  lang: TargetLang
  text: string
  latin: string
  showLatin: boolean
  className?: string
}) {
  if (!showLatin) {
    return (
      <span dir="rtl" lang={lang} className={cn('font-script text-xl leading-relaxed', className)}>
        {text}
      </span>
    )
  }
  return (
    <span className={cn('flex flex-col items-start gap-0.5 text-start', className)}>
      <span lang={`${lang}-Latn`} className="text-lg font-semibold leading-snug">
        {latin}
      </span>
      <span dir="rtl" lang={lang} className="font-script text-base leading-relaxed text-foreground/75">
        {text}
      </span>
    </span>
  )
}
