import { Brain } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Concept } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { useSettings } from '@/store/settings'
import { recallStrings } from '../strings'

/** The meaning to recall, in the learner's language. Never shows the target word. */
export function RecallPrompt({ concept }: { concept: Concept }) {
  const s = recallStrings.use()
  const c = common.use()
  const l = useLocalize()
  const baseLang = useSettings((st) => st.baseLang)
  const alt = (baseLang === 'sv' ? concept.gloss.svAlt : concept.gloss.enAlt)?.slice(0, 2)
  return (
    <div className="relative flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl border bg-card px-4 pb-6 pt-9 text-center shadow-sm">
      <div className="absolute inset-x-3 top-3 flex items-center justify-between">
        <Badge variant="secondary" className="bg-mod-recall/15 text-foreground">
          <Brain className="text-mod-recall" />
          {c.nav.recall}
        </Badge>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {s.pos[concept.pos]}
        </Badge>
      </div>
      {concept.emoji && (
        <div className="text-5xl" aria-hidden>
          {concept.emoji}
        </div>
      )}
      <p className="text-3xl font-semibold text-balance sm:text-4xl" data-testid="recall-gloss">
        {l(concept.gloss)}
      </p>
      {concept.senseNote && <p className="text-sm text-muted-foreground">{l(concept.senseNote)}</p>}
      {alt && alt.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {s.alsoGloss} {alt.join(', ')}
        </p>
      )}
    </div>
  )
}
