import { useEffect, useState } from 'react'
import type { Skill } from '@/content/types'
import { cn } from '@/lib/utils'

export type MeterTone = 'primary' | 'success' | Skill

const TONES: Record<MeterTone, [string, string]> = {
  primary: ['bg-primary', 'bg-primary/25'],
  success: ['bg-success', 'bg-success/30'],
  recognition: ['bg-mod-recognition', 'bg-mod-recognition/30'],
  recall: ['bg-mod-recall', 'bg-mod-recall/30'],
  construction: ['bg-mod-construction', 'bg-mod-construction/30'],
  response: ['bg-mod-response', 'bg-mod-response/30'],
}

const SIZES = { xs: 'h-1.5', sm: 'h-2', md: 'h-3', lg: 'h-4' }

interface MeterProps {
  learned: number
  /** Shown as a lighter segment after the learned part. */
  learning?: number
  total: number
  tone?: MeterTone
  size?: keyof typeof SIZES
  label: string
  /** Starts at these values and grows to the real ones after mount. */
  from?: { learned: number; learning?: number }
  className?: string
}

const width = (n: number, total: number) => `${total ? Math.min(100, (n / total) * 100) : 0}%`

export function Meter({ learned, learning = 0, total, tone = 'primary', size = 'sm', label, from, className }: MeterProps) {
  const [grown, setGrown] = useState(!from)
  useEffect(() => {
    if (grown) return
    const t = setTimeout(() => setGrown(true), 350)
    return () => clearTimeout(t)
  }, [grown])
  const shown = grown || !from ? { learned, learning } : from
  const [solid, soft] = TONES[tone]
  const segment = 'h-full transition-[width] duration-1000 ease-out motion-reduce:transition-none'
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={learned}
      className={cn('flex w-full overflow-hidden rounded-full bg-muted', SIZES[size], className)}
    >
      <div className={cn(segment, solid)} style={{ width: width(shown.learned, total) }} />
      {(shown.learning ?? 0) > 0 && <div className={cn(segment, soft)} style={{ width: width(shown.learning ?? 0, total) }} />}
    </div>
  )
}
