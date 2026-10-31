import { Link2 } from 'lucide-react'
import { EvidenceBadge } from '@/components/evidence-badge'
import { TargetText } from '@/components/target-text'
import { Badge } from '@/components/ui/badge'
import { ReportButton } from '@/components/word-card'
import { acceptedForms, evidenceFor } from '@/content'
import type { Concept, Form, TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { useSettings } from '@/store/settings'
import { recallStrings } from '../strings'

function RegisterBadge({ form }: { form: Form }) {
  const c = common.use()
  if (!form.register || form.register === 'neutral') return null
  return (
    <Badge variant="outline" className="text-[0.7rem] font-normal">
      {c.register[form.register]}
    </Badge>
  )
}

interface AnswerDetailsProps {
  concept: Concept
  lang: TargetLang
  /** The form to feature: the one the learner matched, or the primary form. */
  shown: Form
  /** Small label above the featured form, e.g. "Correct answer". */
  caption?: string
  autoPlay?: boolean
}

/** The correct answer and everything that helps remember it: variants, notes and the other language. */
export function AnswerDetails({ concept, lang, shown, caption, autoPlay = false }: AnswerDetailsProps) {
  const s = recallStrings.use()
  const l = useLocalize()
  const compare = useSettings((st) => st.compare)
  const entry = concept[lang]!
  const primary = entry.primary
  const audioUrl = shown === primary ? (entry.audio?.[0]?.url ?? evidenceFor('concept', lang, concept.id).audio) : undefined
  const others = acceptedForms(entry).filter((f) => f !== shown && f !== primary)
  const other: TargetLang = lang === 'ckb' ? 'fa' : 'ckb'
  const otherEntry = concept[other]

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex flex-col items-center gap-1">
        {caption && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{caption}</p>}
        <TargetText
          lang={lang}
          text={shown.script}
          latin={shown.latin}
          size="xl"
          audio
          audioUrl={audioUrl}
          autoPlay={autoPlay}
          romanization="always"
        />
        <div className="flex items-center gap-1">
          <RegisterBadge form={shown} />
          <EvidenceBadge kind="concept" lang={lang} id={concept.id} showLabel />
        </div>
        {shown.note && <p className="text-xs text-muted-foreground">{l(shown.note)}</p>}
      </div>

      {shown !== primary && (
        <div className="flex w-full max-w-md flex-col items-center gap-1 rounded-xl bg-background/70 px-4 py-2">
          <p className="text-sm text-muted-foreground">{s.variantUsed}</p>
          <TargetText lang={lang} text={primary.script} latin={primary.latin} size="md" audio romanization="always" />
        </div>
      )}

      {entry.notes && (
        <p className="max-w-prose rounded-xl bg-background/70 px-4 py-3 text-start text-sm leading-relaxed">{l(entry.notes)}</p>
      )}

      {others.length > 0 && (
        <div className="w-full max-w-md text-start">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.alsoAccepted}</p>
          <ul className="space-y-1">
            {others.map((v) => (
              <li key={v.script} className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <RegisterBadge form={v} />
                  {v.note && <span className="text-xs text-muted-foreground">{l(v.note)}</span>}
                </span>
                <TargetText lang={lang} text={v.script} latin={v.latin} size="sm" align="start" className="items-end" romanization="always" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {compare && otherEntry && (
        <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-dashed bg-background/60 px-4 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {concept.cognate && <Link2 className="size-3.5" aria-label={s.related} />}
            {s.inOther[other]}
          </span>
          <TargetText lang={other} text={otherEntry.primary.script} latin={otherEntry.primary.latin} size="sm" audio />
        </div>
      )}

      <ReportButton itemKey={`concept:${lang}:${concept.id}`} />
    </div>
  )
}
