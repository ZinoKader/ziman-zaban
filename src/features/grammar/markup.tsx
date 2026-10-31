import { Fragment, type ReactNode } from 'react'
import type { TargetLang } from '@/content/types'
import { isArabicScript } from '@/lib/script/normalize'
import { cn } from '@/lib/utils'
import { parseMarkup, splitScript, type Inline } from './markup-parse'

/** Mixed Latin and Arabic-script text: every Arabic-script run is isolated, RTL and tagged with the language. */
export function ScriptRuns({ text, lang, scriptClassName }: { text: string; lang: TargetLang; scriptClassName?: string }) {
  return (
    <>
      {splitScript(text).map((r, i) =>
        r.script ? (
          <bdi key={i} dir="rtl" lang={lang} className={cn('font-script', scriptClassName)}>
            {r.text}
          </bdi>
        ) : (
          <Fragment key={i}>{r.text}</Fragment>
        ),
      )}
    </>
  )
}

function renderInline(item: Inline, lang: TargetLang, key: number): ReactNode {
  if (item.kind === 'text') return <ScriptRuns key={key} text={item.text} lang={lang} scriptClassName="text-[1.08em]" />
  if (item.kind === 'bold') {
    return (
      <strong key={key} className="font-semibold text-foreground">
        <ScriptRuns text={item.text} lang={lang} scriptClassName="text-[1.12em]" />
      </strong>
    )
  }
  if (isArabicScript(item.text)) {
    return (
      <bdi key={key} dir="rtl" lang={lang} className="rounded-md bg-accent/70 box-decoration-clone px-1.5 py-0.5 font-script text-[1.08em] text-accent-foreground">
        {item.text}
      </bdi>
    )
  }
  return (
    <code key={key} lang={`${lang}-Latn`} className="rounded-md bg-muted box-decoration-clone px-1.5 py-0.5 font-sans text-[0.92em] font-medium tracking-wide">
      {item.text}
    </code>
  )
}

/** Renders explanation markup as React elements (never as HTML). */
export function Markup({ source, lang, className }: { source: string; lang: TargetLang; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {parseMarkup(source).map((p, i) => (
        <p key={i}>{p.map((item, j) => renderInline(item, lang, j))}</p>
      ))}
    </div>
  )
}
