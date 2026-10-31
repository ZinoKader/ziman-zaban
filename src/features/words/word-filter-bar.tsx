import { Search, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { units, type EvidenceLevel } from '@/content'
import type { PartOfSpeech } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { hasActiveFilters, type WordFilters } from './filters'
import { StrengthDot } from './strength-dots'
import { wordsStrings } from './strings'
import { STRENGTHS } from './word-progress'

const ALL = '__all'
const EVIDENCE: EvidenceLevel[] = ['native-reviewed', 'strong', 'good', 'attested', 'none']

interface FilterSelectProps {
  label: string
  allLabel: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: ReactNode }>
}

function FilterSelect({ label, allLabel, value, onChange, options }: FilterSelectProps) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={cn('shrink-0 rounded-full bg-card', value && 'border-primary/60 bg-accent text-accent-foreground')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface WordFilterBarProps {
  filters: WordFilters
  update: (patch: Partial<WordFilters>) => void
  clear: () => void
  posOptions: PartOfSpeech[]
  unitOptions: string[]
  count: number
}

export function WordFilterBar({ filters, update, clear, posOptions, unitOptions, count }: WordFilterBarProps) {
  const s = wordsStrings.use()
  const c = common.use()
  const l = useLocalize()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="sticky top-14 z-30 -mx-4 space-y-2.5 border-b bg-background/90 px-4 pt-3 pb-2.5 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={input}
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && filters.q) {
              e.preventDefault()
              update({ q: '' })
            }
          }}
          aria-label={s.searchLabel}
          placeholder={s.searchPlaceholder}
          dir="auto"
          className="h-11 w-full rounded-full border border-input bg-card ps-10 pe-20 text-base shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {filters.q ? (
            <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => update({ q: '' })} aria-label={s.clearSearch}>
              <X />
            </Button>
          ) : (
            <Kbd className="me-2 hidden sm:inline-flex" title={s.keyboardHint}>
              /
            </Kbd>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div role="group" aria-label={s.filters} className="-my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
          <FilterSelect
            label={s.unit}
            allLabel={s.allUnits}
            value={filters.unit}
            onChange={(unit) => update({ unit })}
            options={units
              .filter((u) => unitOptions.includes(u.id))
              .map((u) => ({ value: u.id, label: `${u.emoji} ${l(u.title)}` }))}
          />
          <FilterSelect
            label={s.pos}
            allLabel={s.allPos}
            value={filters.pos}
            onChange={(pos) => update({ pos: pos as WordFilters['pos'] })}
            options={posOptions.map((p) => ({ value: p, label: s.posLabel[p] }))}
          />
          <FilterSelect
            label={s.progress}
            allLabel={s.allProgress}
            value={filters.progress}
            onChange={(progress) => update({ progress: progress as WordFilters['progress'] })}
            options={STRENGTHS.map((st) => ({
              value: st,
              label: (
                <>
                  <StrengthDot level={st} /> {s.strength[st]}
                </>
              ),
            }))}
          />
          <FilterSelect
            label={s.evidence}
            allLabel={s.allEvidence}
            value={filters.evidence}
            onChange={(evidence) => update({ evidence: evidence as WordFilters['evidence'] })}
            options={EVIDENCE.map((e) => ({ value: e, label: c.evidence[e] }))}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {hasActiveFilters(filters) && (
            <Button variant="ghost" size="xs" onClick={clear}>
              <X /> <span className="hidden sm:inline">{s.clearFilters}</span>
              <span className="sr-only sm:hidden">{s.clearFilters}</span>
            </Button>
          )}
          <span aria-live="polite" className="tabular-nums whitespace-nowrap">
            {s.results(count)}
          </span>
        </div>
      </div>
    </div>
  )
}
