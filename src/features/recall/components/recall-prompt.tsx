import type { Concept } from '@/content/types'
import { useLocalize } from '@/i18n'
import { useSettings } from '@/store/settings'
import { recallStrings } from '../strings'

/** The meaning to recall, in the learner's language. Never shows the target word. */
export function RecallPrompt({ concept }: { concept: Concept }) {
  const s = recallStrings.use()
  const l = useLocalize()
  const baseLang = useSettings((st) => st.baseLang)
  // A sense note says best which meaning is meant; a synonym is only a fallback hint.
  const alt = concept.senseNote ? undefined : (baseLang === 'sv' ? concept.gloss.svAlt : concept.gloss.enAlt)?.[0]
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl border bg-card px-4 py-7 text-center shadow-sm">
      {concept.emoji && (
        <div className="text-5xl" aria-hidden>
          {concept.emoji}
        </div>
      )}
      <p className="text-3xl font-semibold text-balance sm:text-4xl" data-testid="recall-gloss">
        {l(concept.gloss)}
      </p>
      <p className="flex flex-wrap items-baseline justify-center gap-x-1.5 text-xs text-muted-foreground">
        <span>{s.pos[concept.pos]}</span>
        {concept.senseNote && (
          <>
            <span aria-hidden>·</span>
            <span className="text-sm">{l(concept.senseNote)}</span>
          </>
        )}
        {alt && (
          <>
            <span aria-hidden>·</span>
            <span>
              {s.alsoGloss} {alt}
            </span>
          </>
        )}
      </p>
    </div>
  )
}
