import { ArrowUpRight } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'
import type { Concept, TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { cn } from '@/lib/utils'

const ARABIC_RUN = /([\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF][\u0600-\u06FF\u200C\u200D\uFB50-\uFDFF\uFE70-\uFEFF]*(?:\s+[\u0600-\u06FF][\u0600-\u06FF\u200C\u200D]*)*)/g

/** English or Swedish text with embedded Sorani/Persian, which gets the script font and its own direction. */
export function ScriptRich({ text, lang, className }: { text: string; lang: TargetLang; className?: string }) {
  const parts = text.split(ARABIC_RUN)
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} dir="rtl" lang={lang} className="font-script text-[1.15em] leading-none">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </span>
  )
}

/** A course word as a small link to its word card. */
export function WordChip({ concept, lang, className }: { concept: Concept; lang: TargetLang; className?: string }) {
  const l = useLocalize()
  const form = concept[lang]?.primary
  if (!form) return null
  return (
    <Link
      to={`/words/${concept.id}`}
      className={cn(
        'group inline-flex items-center gap-2 rounded-xl border bg-background px-2.5 py-1 transition hover:border-primary/50 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <span dir="rtl" lang={lang} className="font-script text-lg leading-snug">
        {form.script}
      </span>
      <span className="flex flex-col text-start leading-tight">
        <span lang={`${lang}-Latn`} className="text-xs font-medium">{form.latin}</span>
        <span className="text-[0.7rem] text-muted-foreground">{l(concept.gloss)}</span>
      </span>
      <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 rtl:-scale-x-100" />
    </Link>
  )
}

export function SectionHeading({ title, body, id }: { title: string; body?: string; id?: string }) {
  return (
    <div className="mb-4 space-y-1">
      <h2 id={id} className="text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      {body && <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{body}</p>}
    </div>
  )
}
