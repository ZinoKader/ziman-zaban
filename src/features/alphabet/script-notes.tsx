import { Check, Minus } from 'lucide-react'
import { conceptById } from '@/content'
import type { Concept, TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { letterByChar } from './letters'
import { COMPARE_ROWS, PERSIAN_SOUND_GROUPS, SAME_LETTER_ROWS, VOWEL_RULES } from './notes'
import { pickExample } from './script'
import { ScriptRich, SectionHeading, WordChip } from './script-bits'
import { alphabetStrings } from './strings'

function conceptsFor(ids: readonly string[], lang: TargetLang): Concept[] {
  return ids.map((id) => conceptById.get(id)).filter((c): c is Concept => !!c?.[lang])
}

export function VowelRules({ lang }: { lang: TargetLang }) {
  const s = alphabetStrings.use()
  const rules: Record<string, { title: string; body: string }> = s.vowels[lang]
  const examples: Record<string, readonly string[]> = VOWEL_RULES[lang]
  return (
    <section aria-labelledby="vowels">
      <SectionHeading id="vowels" title={s.vowelsTitle} />
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(rules).map(([key, rule], i) => (
          <li key={key} className="flex flex-col gap-3 rounded-3xl border bg-card p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <h3 className="font-semibold leading-snug">
                <ScriptRich text={rule.title} lang={lang} />
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <ScriptRich text={rule.body} lang={lang} />
            </p>
            <div className="mt-auto flex flex-wrap gap-1.5">
              {conceptsFor(examples[key] ?? [], lang).map((c) => (
                <WordChip key={c.id} concept={c} lang={lang} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function LetterChip({ char, lang, arabic }: { char: string; lang: TargetLang; arabic?: boolean }) {
  return (
    <span
      dir="rtl"
      lang={lang}
      className={cn(
        'grid size-11 place-items-center rounded-xl border-2 bg-background font-script text-2xl leading-none',
        arabic && 'border-dashed border-muted-foreground/40',
      )}
    >
      {char}
    </span>
  )
}

export function ArabicLetters({ lang }: { lang: TargetLang }) {
  const s = alphabetStrings.use()
  if (lang === 'ckb') {
    const kept = ['ع', 'ح']
      .map((ch) => letterByChar('ckb', ch))
      .filter((x) => !!x)
      .map((letter) => ({ letter, example: pickExample(letter, 'ckb') }))
    return (
      <section aria-labelledby="arabic">
        <SectionHeading id="arabic" title={s.arabicTitle} />
        <div className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center">
          <p className="flex-1 text-sm leading-relaxed sm:text-base">
            <ScriptRich text={s.arabic.ckb} lang="ckb" />
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {kept.map(({ letter, example }) => (
              <div key={letter.char} className="flex items-center gap-2">
                <LetterChip char={letter.char} lang="ckb" arabic={letter.arabic} />
                {example && <WordChip concept={example.concept} lang="ckb" />}
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }
  return (
    <section aria-labelledby="arabic">
      <SectionHeading id="arabic" title={s.arabicTitle} body={s.arabic.fa} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PERSIAN_SOUND_GROUPS.map((group) => {
          const examples = group.letters
            .slice(1)
            .map((ch) => letterByChar('fa', ch))
            .flatMap((letter) => (letter ? [pickExample(letter, 'fa')] : []))
            .filter((x) => !!x)
          return (
            <div key={group.latin} className="flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div dir="rtl" className="flex gap-1.5">
                  {group.letters.map((ch, i) => (
                    <LetterChip key={ch} char={ch} lang="fa" arabic={i > 0 && !!letterByChar('fa', ch)?.arabic} />
                  ))}
                </div>
                <p className="text-end text-sm text-muted-foreground">
                  <span lang="fa-Latn" className="block text-xl font-semibold text-foreground">{group.latin}</span>
                  {s.arabic.soundsLike(group.latin)}
                </p>
              </div>
              {examples.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {examples.map((ex) => (
                    <WordChip key={ex.concept.id} concept={ex.concept} lang="fa" />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function CompareTable() {
  const s = alphabetStrings.use()
  const c = common.use()
  return (
    <section aria-labelledby="compare" className="space-y-6">
      <SectionHeading id="compare" title={s.compareTitle} body={s.compareBody} />
      <div className="overflow-hidden rounded-3xl border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="w-16 px-3 py-2.5 text-center font-medium">{s.compareCols.letter}</th>
              <th scope="col" className="px-3 py-2.5 text-start font-medium">{s.compareCols.sorani}</th>
              <th scope="col" className="px-3 py-2.5 text-start font-medium">{s.compareCols.persian}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {COMPARE_ROWS.map((row) => {
              const text = s.compare[row.key]
              const letter = letterByChar(row.in, row.char)
              const example = letter ? pickExample(letter, row.in) : undefined
              const cell = (lang: TargetLang, value: string) => {
                const has = row.in === lang
                return (
                  <td className={cn('px-3 py-3 align-top', !has && 'text-muted-foreground')}>
                    <span className="flex items-start gap-1.5">
                      {has ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label={c.languagesShort[lang]} />
                      ) : (
                        <Minus className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden />
                      )}
                      <ScriptRich text={value} lang={lang} />
                    </span>
                    {has && example && <WordChip concept={example.concept} lang={lang} className="mt-2" />}
                  </td>
                )
              }
              return (
                <tr key={row.char}>
                  <th scope="row" className="px-3 py-3 text-center align-top">
                    <span dir="rtl" lang={row.in} className="font-script text-3xl leading-none font-normal">
                      {row.char}
                    </span>
                  </th>
                  {cell('ckb', text.sorani)}
                  {cell('fa', text.persian)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-3 font-semibold">{s.sameLetterTitle}</h3>
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {SAME_LETTER_ROWS.map((row) => (
            <li key={row.char} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <span dir="rtl" lang="fa" className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted font-script text-3xl leading-none">
                {row.char}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap gap-x-3 text-sm">
                  <span>
                    <span className="text-muted-foreground">{c.languagesShort.ckb}</span>{' '}
                    <span lang="ckb-Latn" className="font-semibold">{row.ckb}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">{c.languagesShort.fa}</span>{' '}
                    <span lang="fa-Latn" className="font-semibold">{row.fa}</span>
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{s.sameLetter[row.key]}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
