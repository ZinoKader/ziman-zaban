import type { TargetLang } from '@/content/types'
import { cn } from '@/lib/utils'
import type { Tile } from '../options'
import { responseStrings } from '../strings'

interface TileBuilderProps {
  lang: TargetLang
  bank: Tile[]
  chosen: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  state?: 'idle' | 'right' | 'wrong'
  showLatin: boolean
}

function TileButton({ tile, lang, showLatin, onClick, disabled, label, className }: {
  tile: Tile
  lang: TargetLang
  showLatin: boolean
  onClick: () => void
  disabled?: boolean
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-b-4 bg-card px-3 py-1.5 shadow-xs transition',
        'enabled:hover:-translate-y-0.5 enabled:hover:border-primary/60 enabled:active:translate-y-0 enabled:active:border-b-2',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
        className,
      )}
    >
      {showLatin ? (
        <>
          <span lang={`${lang}-Latn`} className="text-lg font-semibold leading-snug">
            {tile.latin}
          </span>
          <span dir="rtl" lang={lang} className="font-script text-sm leading-snug text-foreground/70">
            {tile.text}
          </span>
        </>
      ) : (
        <span dir="rtl" lang={lang} className="font-script text-xl leading-snug">
          {tile.text}
        </span>
      )}
    </button>
  )
}

/** Builds an answer by tapping word tiles; the answer line follows the reading direction of the leading line. */
export function TileBuilder({ lang, bank, chosen, onChange, disabled, state = 'idle', showLatin }: TileBuilderProps) {
  const s = responseStrings.use()
  const byId = new Map(bank.map((t) => [t.id, t]))
  const flow = showLatin ? 'ltr' : 'rtl'
  return (
    <div className="flex flex-col gap-4">
      <div
        dir={flow}
        aria-live="polite"
        className={cn(
          'flex min-h-20 flex-wrap content-start items-center gap-2 rounded-2xl border-2 border-dashed p-3 transition',
          state === 'idle' && 'border-border bg-muted/30',
          state === 'right' && 'border-solid border-success bg-success/10',
          state === 'wrong' && 'animate-shake border-solid border-destructive bg-destructive/5',
        )}
      >
        {chosen.length === 0 && (
          <span dir="ltr" className="w-full text-center text-sm text-muted-foreground">
            {s.buildEmpty}
          </span>
        )}
        {chosen.map((id, i) => {
          const tile = byId.get(id)!
          return (
            <TileButton
              key={id}
              tile={tile}
              lang={lang}
              showLatin={showLatin}
              disabled={disabled}
              label={s.removeWord(tile.text)}
              className="animate-pop-in"
              onClick={() => onChange(chosen.filter((_, j) => j !== i))}
            />
          )
        })}
      </div>
      <div dir={flow} className="flex flex-wrap justify-center gap-2" role="group">
        {bank.map((tile) => {
          const used = chosen.includes(tile.id)
          return (
            <TileButton
              key={tile.id}
              tile={tile}
              lang={lang}
              showLatin={showLatin}
              disabled={disabled || used}
              label={s.addWord(tile.text)}
              className={cn(used && 'border-dashed bg-muted/40 opacity-40 shadow-none [&>*]:invisible')}
              onClick={() => onChange([...chosen, tile.id])}
            />
          )
        })}
      </div>
    </div>
  )
}
