import { BookOpen, ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { grammarById } from '@/content'
import { useLocalize } from '@/i18n'
import { cn } from '@/lib/utils'
import { constructionStrings } from './strings'

/** Renders the `**bold**` and `code` subset allowed in grammar explanations. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`'))
          return (
            <code key={i} dir="auto" className="rounded bg-muted px-1 font-script">
              {part.slice(1, -1)}
            </code>
          )
        return part
      })}
    </>
  )
}

interface GrammarChipsProps {
  ids: string[] | undefined
  /** Inside a session the grammar page opens in a new tab so the session isn't lost. */
  newTab?: boolean
  className?: string
}

/** Grammar points of a sentence as chips; each opens a short summary with a link to the full page. */
export function GrammarChips({ ids, newTab = true, className }: GrammarChipsProps) {
  const s = constructionStrings.use()
  const l = useLocalize()
  const points = (ids ?? []).map((id) => grammarById.get(id)).filter((g) => !!g)
  if (!points.length) return null
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-1.5', className)} aria-label={s.grammar}>
      {points.map((g) => (
        <Popover key={g.id}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-mod-construction/30 bg-mod-construction/10 px-3 py-1 text-xs font-medium text-foreground transition hover:bg-mod-construction/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-mod-construction/30"
            >
              <BookOpen className="size-3.5 text-mod-construction" />
              {l(g.title)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 gap-2 p-3.5">
            <p className="font-semibold">{l(g.title)}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <RichText text={l(g.explanation).split(/\n\s*\n/)[0]} />
            </p>
            <Link
              to={`/grammar/${g.id}`}
              target={newTab ? '_blank' : undefined}
              rel={newTab ? 'noreferrer' : undefined}
              className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {s.openGrammar}
              {newTab && <ExternalLink className="size-3.5" />}
            </Link>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  )
}
