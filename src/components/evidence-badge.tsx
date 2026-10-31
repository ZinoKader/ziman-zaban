import { BadgeCheck, CircleHelp, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { Popover } from 'radix-ui'
import { evidenceFor, type EvidenceLevel } from '@/content'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'

const STYLE: Record<EvidenceLevel, { icon: typeof BadgeCheck; className: string }> = {
  'native-reviewed': { icon: BadgeCheck, className: 'text-success' },
  strong: { icon: ShieldCheck, className: 'text-success' },
  good: { icon: ShieldCheck, className: 'text-primary' },
  attested: { icon: ShieldQuestion, className: 'text-muted-foreground' },
  none: { icon: CircleHelp, className: 'text-warning' },
}

interface EvidenceBadgeProps {
  kind: 'concept' | 'sentence' | 'qa'
  lang: TargetLang
  id: string
  showLabel?: boolean
  className?: string
}

/** Shows how an item was verified against reference sources; click for details. */
export function EvidenceBadge({ kind, lang, id, showLabel = false, className }: EvidenceBadgeProps) {
  const s = common.use()
  const ev = evidenceFor(kind, lang, id)
  const { icon: Icon, className: color } = STYLE[ev.level]
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition hover:bg-muted', color, className)}
          aria-label={s.evidence[ev.level]}
        >
          <Icon className="size-4" />
          {showLabel && <span>{s.evidence[ev.level]}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          className="z-50 w-72 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg animate-pop-in"
        >
          <p className={cn('mb-1 flex items-center gap-1.5 font-medium', color)}>
            <Icon className="size-4" /> {s.evidence[ev.level]}
          </p>
          <p className="mb-2 text-xs text-muted-foreground">{s.evidence.title}</p>
          <ul className="list-disc space-y-0.5 ps-4 text-xs">
            {ev.checks.length ? ev.checks.map((c) => <li key={c}>{c}</li>) : <li>{s.evidence.none}</li>}
          </ul>
          {ev.ipa && <p className="mt-2 font-mono text-xs text-muted-foreground">IPA {ev.ipa}</p>}
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
