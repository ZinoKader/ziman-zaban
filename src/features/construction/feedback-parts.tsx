import { Mic, Snail, Volume2 } from 'lucide-react'
import { useCanSpeak } from '@/components/audio-button'
import { Button } from '@/components/ui/button'
import type { TargetLang } from '@/content/types'
import { speak } from '@/lib/audio'
import { cn } from '@/lib/utils'
import type { DiffOp, TileStatus } from './logic'
import { constructionStrings } from './strings'
import { WordTile } from './word-tile'

/** The learner's tiles after checking, coloured by whether each one is in the right place. */
export function PlacedReview({
  lang,
  tiles,
  statuses,
  showLatin,
}: {
  lang: TargetLang
  tiles: Array<{ text: string; latin: string }>
  statuses: TileStatus[]
  showLatin: boolean
}) {
  const s = constructionStrings.use()
  const used = new Set(statuses)
  return (
    <div className="space-y-2">
      <div dir={showLatin ? 'ltr' : 'rtl'} className="flex flex-wrap justify-center gap-2">
        {tiles.map((t, i) => (
          <WordTile key={i} lang={lang} text={t.text} latin={t.latin} showLatin={showLatin} state={statuses[i]} />
        ))}
      </div>
      {(used.has('misplaced') || used.has('wrong')) && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(['correct', 'misplaced', 'wrong'] as const)
            .filter((k) => used.has(k))
            .map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'size-2.5 rounded-full',
                    k === 'correct' && 'bg-success',
                    k === 'misplaced' && 'bg-warning',
                    k === 'wrong' && 'bg-destructive',
                  )}
                />
                {s.legend[k]}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

/** Word-by-word comparison of a typed sentence with the closest correct version. */
export function TokenDiff({ lang, ops, script }: { lang: TargetLang; ops: DiffOp[]; script: 'arabic' | 'latin' }) {
  const s = constructionStrings.use()
  const arabic = script === 'arabic'
  const word = cn(arabic ? 'font-script text-xl' : 'text-base font-medium')
  return (
    <div
      dir={arabic ? 'rtl' : 'ltr'}
      lang={arabic ? lang : `${lang}-Latn`}
      className="flex flex-wrap items-start justify-center gap-1.5"
    >
      {ops.map((op, i) => {
        if (op.type === 'same')
          return (
            <span key={i} className={cn('rounded-lg border border-success/40 bg-success/10 px-2 py-0.5', word)}>
              {op.input}
            </span>
          )
        if (op.type === 'extra')
          return (
            <span
              key={i}
              className={cn(
                'rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive line-through decoration-2',
                word,
              )}
            >
              {op.input}
            </span>
          )
        if (op.type === 'missing')
          return (
            <span key={i} className="flex flex-col items-center rounded-lg border-2 border-dashed border-success/60 px-2 py-0.5">
              <span className={cn('text-success', word)}>{op.expected}</span>
              <span dir="ltr" lang="" className="font-sans text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {s.missing}
              </span>
            </span>
          )
        return (
          <span key={i} className="flex flex-col items-center rounded-lg border border-destructive/40 bg-destructive/5 px-2 py-0.5">
            <span className={cn('text-destructive line-through decoration-2', word)}>{op.input}</span>
            <span className={cn('text-success', word)}>{op.expected}</span>
          </span>
        )
      })}
    </div>
  )
}

/** Shadowing: after a correct answer, say the sentence aloud along with the audio. */
export function Shadowing({ lang, text, url }: { lang: TargetLang; text: string; url?: string }) {
  const s = constructionStrings.use()
  const canSpeak = useCanSpeak(lang, url)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-mod-construction/25 bg-mod-construction/5 p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mod-construction/15 text-mod-construction">
        <Mic className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-medium">{s.shadowTitle}</p>
        <p className="text-sm text-muted-foreground">{canSpeak ? s.shadowBody : s.shadowNoAudio}</p>
      </div>
      {canSpeak && (
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => void speak({ lang, text, url })}>
            <Volume2 /> {s.replay}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void speak({ lang, text, url, rate: 0.6 })} aria-label={s.slow}>
            <Snail />
          </Button>
        </div>
      )}
    </div>
  )
}
