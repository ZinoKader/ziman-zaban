import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { TargetText } from '@/components/target-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { cn } from '@/lib/utils'
import { soundLabel, type Letter } from './letters'
import { ScriptRich } from './script-bits'
import { contextualForms, type LetterExample } from './script'
import { alphabetStrings } from './strings'

interface LetterDetailProps {
  letter: Letter
  lang: TargetLang
  example?: LetterExample
  className?: string
}

export function LetterDetail({ letter, lang, example, className }: LetterDetailProps) {
  const s = alphabetStrings.use()
  const l = useLocalize()
  const forms = contextualForms(letter)
  const isVowel = letter.role === 'vowel' || letter.role === 'both'

  return (
    <article className={cn('flex flex-col gap-5', className)} aria-live="polite">
      <header className="flex items-start gap-4">
        <span
          dir="rtl"
          lang={lang}
          className={cn(
            'grid size-24 shrink-0 place-items-center rounded-3xl border-2 font-script text-6xl leading-none',
            isVowel ? 'border-primary/30 bg-primary/8 text-primary' : 'bg-card',
          )}
        >
          {letter.char}
        </span>
        <div className="min-w-0 space-y-1.5 pt-1">
          <p className="flex items-baseline gap-2">
            <span lang={`${lang}-Latn`} className="text-3xl font-semibold tracking-tight">
              {letter.latin.length ? soundLabel(letter) : s.detail.silent}
            </span>
            <span className="font-mono text-sm text-muted-foreground">[{letter.ipa.join(', ')}]</span>
          </p>
          <p className="text-sm">{l(letter.hint)}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-normal">
              {s.detail.name}: <span lang={`${lang}-Latn`}>{letter.name}</span>
            </Badge>
            <Badge variant="outline" className="font-normal">
              {s.detail.roles[letter.role]}
            </Badge>
            {letter.arabic && (
              <Badge variant="outline" className="border-dashed font-normal">
                {s.detail.arabic}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {letter.note && (
        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm leading-relaxed">
          <ScriptRich text={l(letter.note)} lang={lang} />
        </p>
      )}

      <section aria-label={s.detail.shapes}>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{s.detail.shapes}</h3>
        <div className={cn('grid gap-2', forms.length === 4 ? 'grid-cols-4' : 'grid-cols-2')}>
          {forms.map((f) => (
            <div key={f.position} className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3">
              <span dir="rtl" lang={lang} className="font-script text-4xl leading-[1.5]">
                {f.text}
              </span>
              <span className="text-xs text-muted-foreground">{s.detail.positions[f.position]}</span>
            </div>
          ))}
        </div>
        {!letter.joinsLeft && <p className="mt-2 text-xs text-muted-foreground">{s.detail.nonJoining}</p>}
      </section>

      <section aria-label={s.detail.example}>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{s.detail.example}</h3>
        {example ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-4 py-4">
            {example.concept.emoji && (
              <span className="text-2xl" aria-hidden>
                {example.concept.emoji}
              </span>
            )}
            <TargetText
              lang={lang}
              text={example.form.script}
              latin={example.form.latin}
              size="lg"
              audio
              audioUrl={example.audioUrl}
              romanization="always"
            />
            <p className="text-sm text-muted-foreground">{l(example.concept.gloss)}</p>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/words/${example.concept.id}`}>
                {s.detail.openWord} <ArrowUpRight className="rtl:-scale-x-100" />
              </Link>
            </Button>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">
            {s.detail.noExample}
          </p>
        )}
      </section>
    </article>
  )
}
