import type { Strength } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { wordsStrings } from './strings'
import type { WordStrength } from './word-progress'

const STRENGTH_COLOR: Record<Strength, string> = {
  new: 'border-muted-foreground/40 bg-transparent',
  learning: 'border-warning bg-warning',
  young: 'border-primary bg-primary/70',
  mature: 'border-success bg-success',
}

export function StrengthDot({ level, className }: { level: Strength; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2.5 rounded-full border-[1.5px]', STRENGTH_COLOR[level], className)} />
}

/** Two dots: recognition, then recall. */
export function StrengthDots({ strength, className }: { strength: WordStrength; className?: string }) {
  const s = wordsStrings.use()
  const label = [
    s.dotLabel(s.recognition, s.strength[strength.recognition]),
    s.dotLabel(s.recall, s.strength[strength.recall]),
  ].join(', ')
  return (
    <span role="img" aria-label={label} title={label} className={cn('flex shrink-0 items-center gap-1', className)}>
      <StrengthDot level={strength.recognition} />
      <StrengthDot level={strength.recall} />
    </span>
  )
}
