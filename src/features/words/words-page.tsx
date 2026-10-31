import { BookA, SearchX } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { conceptById, conceptsFor } from '@/content'
import { PARTS_OF_SPEECH, type TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { applyFilters, hasActiveFilters, useWordFilters } from './filters'
import { buildWordIndex, searchWords } from './search-index'
import { wordsStrings } from './strings'
import { useMediaQuery } from './use-media-query'
import { WordDetail } from './word-detail'
import { WordFilterBar } from './word-filter-bar'
import { WordList } from './word-list'
import { wordStrength, type WordStrength } from './word-progress'

const EXAMPLE_QUERIES: Record<TargetLang, [string, string]> = { ckb: ['supas', 'bira'], fa: ['mamnun', 'baradar'] }

interface EmptyStateProps {
  filtered: boolean
  onClear: () => void
  courseEmpty: boolean
  lang: TargetLang
}

function EmptyState({ filtered, onClear, courseEmpty, lang }: EmptyStateProps) {
  const s = wordsStrings.use()
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        {courseEmpty ? <BookA className="size-7" /> : <SearchX className="size-7" />}
      </span>
      {courseEmpty ? (
        <p className="text-muted-foreground">{s.emptyCourse}</p>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{s.emptyTitle}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.emptyHint(...EXAMPLE_QUERIES[lang])}</p>
          {filtered && (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.emptyFiltered}</p>
              <Button variant="outline" size="sm" onClick={onClear}>
                {s.clearFilters}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}

function DetailBody({ conceptId, lang, backTo }: { conceptId: string; lang: TargetLang; backTo: string }) {
  const s = wordsStrings.use()
  const concept = conceptById.get(conceptId)
  if (!concept?.[lang]) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-muted-foreground">{s.notFound}</p>
        <Button asChild variant="outline" size="sm">
          <Link to={backTo}>{s.backToList}</Link>
        </Button>
      </div>
    )
  }
  return <WordDetail concept={concept} lang={lang} />
}

export function WordsPage() {
  const s = wordsStrings.use()
  const l = useLocalize()
  const { conceptId } = useParams()
  const navigate = useNavigate()
  const lang = useSettings((st) => st.targetLang)
  const baseLang = useSettings((st) => st.baseLang)
  const compare = useSettings((st) => st.compare)
  const romanization = useSettings((st) => st.romanization)
  const cards = useProgress((st) => st.cards)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { filters, update, clear, search } = useWordFilters()

  const all = useMemo(() => conceptsFor(lang), [lang])
  const index = useMemo(() => buildWordIndex(all, lang, compare), [all, lang, compare])
  const strengths = useMemo(() => {
    const m = new Map<string, WordStrength>()
    for (const c of all) m.set(c.id, wordStrength(cards, lang, c.id))
    return m
  }, [all, cards, lang])
  const matches = useMemo(() => searchWords(index, filters.q), [index, filters.q])
  const visible = useMemo(() => {
    const filtered = applyFilters(matches, filters, lang, cards)
    // Keep unit groups in curriculum order; inside a unit, best matches first.
    const unitRank = new Map([...new Set(all.map((c) => c.unit))].map((u, i) => [u, i]))
    return filtered
      .map((c, i) => ({ c, i }))
      .sort((a, b) => (unitRank.get(a.c.unit) ?? 0) - (unitRank.get(b.c.unit) ?? 0) || a.i - b.i)
      .map(({ c }) => c)
  }, [matches, filters, lang, cards, all])

  const posOptions = useMemo(() => PARTS_OF_SPEECH.filter((p) => all.some((c) => c.pos === p)), [all])
  const unitOptions = useMemo(() => [...new Set(all.map((c) => c.unit))], [all])
  const strengthOf = useCallback((id: string) => strengths.get(id)!, [strengths])
  const linkFor = useCallback((id: string) => `/words/${encodeURIComponent(id)}${search}`, [search])
  const backTo = `/words${search}`
  const selected = conceptId ? conceptById.get(conceptId) : undefined

  return (
    <div className="mx-auto max-w-6xl px-4">
      <header className="pt-6 pb-1 sm:pt-8">
        <h1 className="text-3xl font-semibold tracking-tight">{s.title}</h1>
        <p className="mt-1.5 max-w-prose text-[0.95rem] leading-relaxed text-muted-foreground">
          {s.intro(all.length, s.langName[lang])}
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <section aria-label={s.title} className="min-w-0">
          <WordFilterBar
            filters={filters}
            update={update}
            clear={clear}
            posOptions={posOptions}
            unitOptions={unitOptions}
            count={visible.length}
          />
          {visible.length === 0 ? (
            <EmptyState filtered={hasActiveFilters(filters)} onClear={clear} courseEmpty={all.length === 0} lang={lang} />
          ) : (
            <WordList
              concepts={visible}
              lang={lang}
              baseLang={baseLang}
              compare={compare}
              romanization={romanization}
              strengthOf={strengthOf}
              selectedId={conceptId}
              linkFor={linkFor}
            />
          )}
        </section>

        {isDesktop && (
          <aside
            aria-label={selected ? l(selected.gloss) : s.title}
            className="sticky top-[4.5rem] mt-4 max-h-[calc(100dvh-5.5rem)] self-start overflow-y-auto overscroll-contain rounded-3xl border bg-card p-6 shadow-xs"
          >
            {conceptId ? (
              <DetailBody key={conceptId} conceptId={conceptId} lang={lang} backTo={backTo} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <BookA className="size-8" aria-hidden />
                <p className="max-w-60 text-sm leading-relaxed">{s.pickWord}</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {!isDesktop && (
        <Sheet open={!!conceptId} onOpenChange={(open) => !open && navigate(backTo)}>
          <SheetContent
            side="bottom"
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).focus()
            }}
            className="max-h-[92dvh] gap-0 overflow-y-auto outline-none overscroll-contain rounded-t-3xl px-5 pt-8 pb-10">
            <SheetTitle className="sr-only">{selected ? l(selected.gloss) : s.title}</SheetTitle>
            <SheetDescription className="sr-only">{s.title}</SheetDescription>
            <div aria-hidden className="absolute top-2.5 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/25" />
            {conceptId && <DetailBody key={conceptId} conceptId={conceptId} lang={lang} backTo={backTo} />}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
