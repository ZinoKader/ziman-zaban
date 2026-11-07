import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MedalTier } from './medals'

const DISC: Record<MedalTier, string> = {
  bronze: 'bg-[radial-gradient(circle_at_30%_25%,#ffe0bd,#d08a4f_45%,#8a4f22)] text-[#4a2608] ring-[#f3c08c]',
  silver: 'bg-[radial-gradient(circle_at_30%_25%,#ffffff,#c4ccd6_45%,#7f8a99)] text-[#2b3340] ring-[#e6ebf1]',
  gold: 'bg-[radial-gradient(circle_at_30%_25%,#fff6c2,#f1bf2a_45%,#a8740a)] text-[#4d3300] ring-[#ffe58a]',
  star: 'bg-[radial-gradient(circle_at_30%_25%,#fde4ff,#b98cff_45%,#5b3cc4)] text-white ring-[#e8d3ff]',
}

const RIBBON: Record<MedalTier, [string, string]> = {
  bronze: ['bg-[#c2410c]', 'bg-[#9a3412]'],
  silver: ['bg-[#2563eb]', 'bg-[#1e40af]'],
  gold: ['bg-[#dc2626]', 'bg-[#991b1b]'],
  star: ['bg-[#db2777]', 'bg-[#7c3aed]'],
}

interface MedalProps {
  words: number
  tier: MedalTier
  wordsLabel: string
  size?: 'sm' | 'lg'
  earned?: boolean
  className?: string
}

export function Medal({ words, tier, wordsLabel, size = 'sm', earned = true, className }: MedalProps) {
  const lg = size === 'lg'
  const [left, right] = RIBBON[tier]
  return (
    <div className={cn('relative flex flex-col items-center', !earned && 'opacity-40 grayscale', className)} aria-hidden>
      <div className={cn('flex', lg ? '-mb-3 h-14 gap-1' : '-mb-1.5 h-6 gap-0.5')}>
        <span className={cn('block h-full -skew-x-12', lg ? 'w-7' : 'w-3', left)} />
        <span className={cn('block h-full skew-x-12', lg ? 'w-7' : 'w-3', right)} />
      </div>
      <div
        className={cn(
          'relative grid place-items-center rounded-full shadow-lg ring-4 ring-inset',
          lg ? 'size-40' : 'size-14',
          DISC[tier],
        )}
      >
        <div className={cn('absolute rounded-full border-2 border-white/40', lg ? 'inset-3' : 'inset-1.5')} />
        <div className="relative flex flex-col items-center leading-none">
          {tier === 'star' && <Star className={cn('fill-current', lg ? 'mb-1 size-7' : 'size-3')} />}
          <span className={cn('font-bold tabular-nums', lg ? 'text-5xl' : 'text-base')}>{words}</span>
          <span className={cn('font-medium uppercase tracking-wide', lg ? 'mt-1 text-sm' : 'text-[0.55rem]')}>{wordsLabel}</span>
        </div>
      </div>
    </div>
  )
}
