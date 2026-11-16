import type { Concept } from '@/content/types'
import { useLocalize } from '@/i18n'
import { recallStrings } from '../strings'
import { ContentIcon } from '@/components/content-icon'

/** The meaning to recall, in the learner's language. Never shows the target word. */
export function RecallPrompt({ concept }: { concept: Concept }) {
  const s = recallStrings.use()
  const l = useLocalize()
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border bg-card px-4 py-7 text-center">
      {concept.icon && <ContentIcon name={concept.icon} strokeWidth={1.5} className="size-12 text-muted-foreground" />}
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
      </p>
    </div>
  )
}
