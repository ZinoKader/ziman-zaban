import { ArrowLeft, Link2Off, MoveLeft, Shapes } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { TargetText } from '@/components/target-text'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { conceptById } from '@/content'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { speak, useVoice } from '@/lib/audio'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { LetterDetail } from './letter-detail'
import { LetterQuiz } from './letter-quiz'
import { LETTERS, letterByChar, soundLabel, type Letter } from './letters'
import { ANATOMY_WORD } from './notes'
import { contextualForms, pickExample, type Position } from './script'
import { ScriptRich, SectionHeading } from './script-bits'
import { ArabicLetters, CompareTable, VowelRules } from './script-notes'
import { alphabetStrings } from './strings'

type Filter = 'all' | 'vowels' | 'nonJoining' | 'arabic'

const isVowel = (x: Letter) => x.role === 'vowel' || x.role === 'both'

const FILTERS: Record<Filter, (x: Letter) => boolean> = {
  all: () => true,
  vowels: isVowel,
  nonJoining: (x) => !x.joinsLeft,
  arabic: (x) => !!x.arabic,
}

function useIsDesktop() {
  const query = '(min-width: 1024px)'
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  const [matches, setMatches] = useState(() => supported && window.matchMedia(query).matches)
  useEffect(() => {
    if (!supported) return
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [supported])
  return matches
}

function LangToggle({ value, onChange }: { value: TargetLang; onChange: (l: TargetLang) => void }) {
  const c = common.use()
  const s = alphabetStrings.use()
  return (
    <div role="radiogroup" aria-label={s.showFor} className="grid shrink-0 grid-cols-2 rounded-full border bg-muted p-1 sm:inline-grid">
      {(['ckb', 'fa'] as TargetLang[]).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={cn(
            'flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            value === l ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span lang={l} className="font-script">{l === 'ckb' ? 'کوردی' : 'فارسی'}</span>
          <span className="sm:hidden">{c.languagesShort[l]}</span>
          <span className="hidden sm:inline">{c.languages[l]}</span>
        </button>
      ))}
    </div>
  )
}

function Facts({ lang }: { lang: TargetLang }) {
  const s = alphabetStrings.use()
  const letters = LETTERS[lang]
  const nonJoiners = letters.filter((x) => !x.joinsLeft)
  const count = lang === 'ckb' ? 33 : 32
  const cards = [
    { icon: MoveLeft, title: s.facts.rtl, body: s.facts.rtlBody },
    { icon: Shapes, title: s.facts.join, body: s.facts.joinBody },
    { icon: null, glyph: lang === 'ckb' ? 'ئ' : 'آ', title: s.facts.count(count), body: s.facts.countBody[lang] },
  ]
  return (
    <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className="flex flex-col gap-2 rounded-3xl border bg-card p-3.5 shadow-xs sm:p-4">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            {card.icon ? (
              <card.icon className="size-5" />
            ) : (
              <span lang={lang} className="font-script text-xl leading-none">{card.glyph}</span>
            )}
          </span>
          <h2 className="font-semibold">{card.title}</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            <ScriptRich text={card.body} lang={lang} />
          </p>
        </div>
      ))}
      <div className="flex flex-col gap-2 rounded-3xl border bg-card p-3.5 shadow-xs sm:p-4">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Link2Off className="size-5" />
        </span>
        <h2 className="font-semibold">{s.facts.gaps}</h2>
        <p className="text-xs text-muted-foreground sm:text-sm">{s.facts.gapsBody}</p>
        <p dir="rtl" lang={lang} className="font-script text-xl sm:text-2xl sm:tracking-wide">
          {nonJoiners.filter((x) => x.char.length === 1).map((x) => x.char).join(' ')}
        </p>
      </div>
    </section>
  )
}

/** Splits a word into letters (keeping Sorani وو together) and works out each letter's shape in it. */
function spellOut(word: string, lang: TargetLang) {
  const chars = Array.from(word.normalize('NFC')).filter((ch) => !/[\u200C\u200D\s؟?!.]/.test(ch))
  const letters: Letter[] = []
  for (let i = 0; i < chars.length; i++) {
    const pair = chars[i] + (chars[i + 1] ?? '')
    const digraph = lang === 'ckb' && pair === 'وو' ? letterByChar(lang, pair) : undefined
    const letter = digraph ?? letterByChar(lang, chars[i])
    if (!letter) return []
    letters.push(letter)
    if (digraph) i++
  }
  return letters.map((letter, i) => {
    const joinsPrev = i > 0 && letters[i - 1].joinsLeft
    const joinsNext = letter.joinsLeft && i < letters.length - 1
    const position: Position = joinsPrev ? (joinsNext ? 'medial' : 'final') : joinsNext ? 'initial' : 'isolated'
    return { letter, text: contextualForms(letter).find((f) => f.position === position)!.text }
  })
}

function Anatomy({ lang, onPick }: { lang: TargetLang; onPick: (l: Letter) => void }) {
  const s = alphabetStrings.use()
  const concept = conceptById.get(ANATOMY_WORD[lang])
  const form = concept?.[lang]?.primary
  const parts = useMemo(() => (form ? spellOut(form.script, lang) : []), [form, lang])
  if (!form || !parts.length) return null
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border bg-linear-to-br from-primary/8 via-card to-card p-5 text-center shadow-xs sm:flex-row sm:p-6 sm:text-start">
      <div className="space-y-1 sm:flex-1">
        <h2 className="text-lg font-semibold">{s.anatomy}</h2>
        <p className="text-sm text-muted-foreground">{s.anatomyBody}</p>
      </div>
      <TargetText lang={lang} text={form.script} latin={form.latin} size="xl" audio romanization="always" />
      <ArrowLeft className="hidden size-5 text-muted-foreground sm:block rtl:rotate-180" aria-hidden />
      <ol dir="rtl" className="flex flex-wrap items-center justify-center gap-1.5">
        {parts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span className="text-muted-foreground" aria-hidden>
                +
              </span>
            )}
            <li>
              <button
                type="button"
                onClick={() => onPick(p.letter)}
                className="flex flex-col items-center rounded-2xl border bg-background px-3 pt-1 pb-1.5 transition hover:border-primary/50 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`${p.letter.char} ${soundLabel(p.letter)}`}
              >
                <span lang={lang} className="font-script text-3xl leading-[1.5]">{p.text}</span>
                <span lang={`${lang}-Latn`} className="text-xs text-muted-foreground">{soundLabel(p.letter) || '·'}</span>
              </button>
            </li>
          </Fragment>
        ))}
      </ol>
    </section>
  )
}

function LetterTile({ letter, lang, selected, onClick }: { letter: Letter; lang: TargetLang; selected: boolean; onClick: () => void }) {
  const s = alphabetStrings.use()
  const vowel = isVowel(letter)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${letter.char}, ${letter.name}, ${letter.latin.length ? soundLabel(letter) : s.detail.silent}`}
      className={cn(
        'relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl border-2 bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-0 motion-reduce:hover:translate-y-0',
        vowel && 'bg-primary/8',
        letter.arabic && 'border-dashed border-muted-foreground/40',
        selected && 'border-primary ring-3 ring-primary/25',
      )}
    >
      <span lang={lang} className="font-script text-3xl leading-[1.4] sm:text-4xl">{letter.char}</span>
      <span lang={`${lang}-Latn`} dir="ltr" className="text-xs font-medium text-muted-foreground">
        {letter.latin.length ? soundLabel(letter) : '—'}
      </span>
      {!letter.joinsLeft && <span className="absolute top-1.5 left-1.5 h-3 w-0.5 rounded-full bg-mod-construction/70" aria-hidden />}
    </button>
  )
}

export function AlphabetPage() {
  const s = alphabetStrings.use()
  const targetLang = useSettings((st) => st.targetLang)
  const [override, setOverride] = useState<TargetLang | null>(null)
  const lang = override ?? targetLang
  const letters = LETTERS[lang]
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedChar, setSelectedChar] = useState<string>(letters[0].char)
  const [sheetOpen, setSheetOpen] = useState(false)
  const isDesktop = useIsDesktop()
  const voice = useVoice(lang)

  const selected = letterByChar(lang, selectedChar) ?? letters[0]
  const examples = useMemo(() => new Map(letters.map((x) => [x.char, pickExample(x, lang)])), [letters, lang])
  const visible = letters.filter(FILTERS[filter])

  const switchLang = (l: TargetLang) => {
    setOverride(l === targetLang ? null : l)
    setSelectedChar(LETTERS[l][0].char)
  }

  const pick = (letter: Letter) => {
    setSelectedChar(letter.char)
    if (!isDesktop) setSheetOpen(true)
    const ex = examples.get(letter.char)
    if (ex && (voice || ex.audioUrl)) void speak({ lang, text: ex.form.script, url: ex.audioUrl, voice })
  }

  const detail = <LetterDetail letter={selected} lang={lang} example={examples.get(selected.char)} />

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-sm font-medium text-primary">{s.eyebrow}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{s.title}</h1>
          <p className="text-muted-foreground sm:text-lg">{s.intro[lang]}</p>
        </div>
        <LangToggle value={lang} onChange={switchLang} />
      </header>

      <Facts lang={lang} />
      <Anatomy lang={lang} onPick={pick} />

      <section aria-labelledby="letters">
        <SectionHeading id="letters" title={s.letters} body={s.lettersHint} />
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="radiogroup" aria-label={s.letters} className="flex flex-wrap gap-1.5">
            {(Object.keys(FILTERS) as Filter[])
              .filter((f) => letters.some(FILTERS[f]))
              .map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    filter === f ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.filters[f]}
                </button>
              ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-primary/15" aria-hidden /> {s.legend.vowel}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 rounded-full bg-mod-construction/70" aria-hidden /> {s.legend.nonJoining}
            </li>
            {letters.some((x) => x.arabic) && (
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-dashed border-muted-foreground/60" aria-hidden /> {s.legend.arabic}
              </li>
            )}
          </ul>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div dir="rtl" className="grid grid-cols-4 content-start gap-2 min-[420px]:grid-cols-5 sm:grid-cols-7 lg:grid-cols-6 xl:grid-cols-7">
            {visible.map((letter) => (
              <LetterTile
                key={letter.char}
                letter={letter}
                lang={lang}
                selected={letter.char === selected.char}
                onClick={() => pick(letter)}
              />
            ))}
          </div>
          {isDesktop && (
            <aside className="sticky top-20 self-start rounded-3xl border bg-card/60 p-5 shadow-xs">{detail}</aside>
          )}
        </div>
      </section>

      {!isDesktop && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl px-4 pt-6 pb-safe">
            <SheetTitle className="sr-only">
              {selected.char} {selected.name}
            </SheetTitle>
            <SheetDescription className="sr-only">{s.lettersHint}</SheetDescription>
            {detail}
          </SheetContent>
        </Sheet>
      )}

      <VowelRules lang={lang} />
      <ArabicLetters lang={lang} />
      <CompareTable />

      <section aria-labelledby="quiz">
        <SectionHeading id="quiz" title={s.quiz.title} />
        <LetterQuiz key={lang} lang={lang} />
      </section>
    </div>
  )
}

