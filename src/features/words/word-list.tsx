import { memo } from 'react'
import { Link } from 'react-router'
import { AudioButton } from '@/components/audio-button'
import { evidenceFor, unitById } from '@/content'
import type { BaseLang, Concept, TargetLang } from '@/content/types'
import { cn } from '@/lib/utils'
import type { RomanizationMode } from '@/store/settings'
import { StrengthDots } from './strength-dots'
import { wordsStrings } from './strings'
import type { WordStrength } from './word-progress'
import { useShowScript } from '@/components/script-toggle'

interface RowProps {
  concept: Concept
  lang: TargetLang
  baseLang: BaseLang
  compare: boolean
  romanization: RomanizationMode
  strength: WordStrength
  selected: boolean
  to: string
}

const WordRow = memo(function WordRow({ concept, lang, baseLang, compare, romanization, strength, selected, to }: RowProps) {
  const entry = concept[lang]!
  const showScript = useShowScript()
  const other: TargetLang = lang === 'ckb' ? 'fa' : 'ckb'
  const otherEntry = compare ? concept[other] : undefined
  const audioUrl = entry.audio?.[0]?.url ?? evidenceFor('concept', lang, concept.id).audio
  return (
    <li
      className={cn(
        'group relative flex items-center gap-2 rounded-2xl pe-1.5 transition-colors hover:bg-muted/70',
        selected && 'bg-accent hover:bg-accent',
      )}
    >
      <Link
        to={to}
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 ps-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="w-8 shrink-0 text-center text-2xl leading-none" aria-hidden>
          {concept.emoji}
        </span>
        <span className="flex w-28 shrink-0 flex-col items-start sm:w-36">
          {romanization === 'never' ? (
            <span dir="rtl" lang={lang} className="font-script text-lg font-medium leading-[1.6]">
              {entry.primary.script}
            </span>
          ) : (
            <>
              <span lang={`${lang}-Latn`} className="max-w-full truncate text-base font-semibold leading-snug">
                {entry.primary.latin}
              </span>
              {showScript && (
                <span dir="rtl" lang={lang} className="font-script text-sm leading-normal text-foreground/70">
                  {entry.primary.script}
                </span>
              )}
            </>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">
            {concept.gloss[baseLang]}
            {concept.senseNote && (
              <span className="ms-1.5 text-sm font-normal text-muted-foreground">{concept.senseNote[baseLang]}</span>
            )}
          </span>
          {otherEntry && (
            <span className="flex items-baseline gap-1.5 truncate text-xs text-muted-foreground">
              {romanization !== 'never' && <span lang={`${other}-Latn`}>{otherEntry.primary.latin}</span>}
              {(showScript || romanization === 'never') && (
                <span lang={other} dir="rtl" className="font-script text-sm text-foreground/80">
                  {otherEntry.primary.script}
                </span>
              )}
            </span>
          )}
        </span>
      </Link>
      <StrengthDots strength={strength} />
      <AudioButton lang={lang} text={entry.primary.script} url={audioUrl} />
    </li>
  )
})

interface WordListProps {
  concepts: Concept[]
  lang: TargetLang
  baseLang: BaseLang
  compare: boolean
  romanization: RomanizationMode
  strengthOf: (id: string) => WordStrength
  selectedId?: string
  linkFor: (id: string) => string
}

export function WordList({ concepts, strengthOf, selectedId, linkFor, ...rest }: WordListProps) {
  const s = wordsStrings.use()
  const groups: Array<{ unit: string; items: Concept[] }> = []
  for (const c of concepts) {
    const last = groups[groups.length - 1]
    if (last?.unit === c.unit) last.items.push(c)
    else groups.push({ unit: c.unit, items: [c] })
  }

  return (
    <div className="space-y-8 pt-4">
      {groups.map(({ unit, items }, i) => {
        const u = unitById.get(unit)
        const headingId = `words-unit-${unit}-${i}`
        return (
          <section key={headingId} aria-labelledby={headingId}>
            <h2 id={headingId} className="mb-2 flex items-center gap-2 px-3 text-sm font-semibold text-muted-foreground">
              {u && <span aria-hidden className="text-lg">{u.emoji}</span>}
              <span className="text-foreground">{u ? u.title[rest.baseLang] : unit}</span>
              <span className="font-normal tabular-nums">· {s.results(items.length)}</span>
            </h2>
            <ul className="space-y-0.5">
              {items.map((c) => (
                <WordRow
                  key={c.id}
                  concept={c}
                  strength={strengthOf(c.id)}
                  selected={c.id === selectedId}
                  to={linkFor(c.id)}
                  {...rest}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
