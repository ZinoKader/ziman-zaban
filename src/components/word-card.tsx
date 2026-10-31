import { Flag, Link2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { evidenceFor } from '@/content'
import type { Concept, Form, TargetLang } from '@/content/types'
import { defineStrings, useLocalize } from '@/i18n'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { EvidenceBadge } from './evidence-badge'
import { TargetText } from './target-text'

const strings = defineStrings({
  en: {
    alsoSaid: 'Also said',
    plural: 'Plural',
    inOther: { ckb: 'In Sorani', fa: 'In Persian' },
    cognate: 'Related words',
    reportTitle: 'Report a problem with this item',
    reportBody: 'Describe what looks wrong (spelling, meaning, pronunciation...). Reports are saved on this device and can be exported for the content team from Settings.',
    send: 'Save report',
    thanks: 'Thanks, saved.',
  },
  sv: {
    alsoSaid: 'Sägs också',
    plural: 'Plural',
    inOther: { ckb: 'På sorani', fa: 'På persiska' },
    cognate: 'Besläktade ord',
    reportTitle: 'Rapportera ett fel i det här ordet',
    reportBody: 'Beskriv vad som ser fel ut (stavning, betydelse, uttal...). Rapporter sparas på enheten och kan exporteras till innehållsteamet från Inställningar.',
    send: 'Spara rapport',
    thanks: 'Tack, sparat.',
  },
})

function RegisterBadge({ form }: { form: Form }) {
  const s = common.use()
  if (!form.register || form.register === 'neutral') return null
  return (
    <Badge variant="outline" className="text-[0.7rem] font-normal">
      {s.register[form.register]}
    </Badge>
  )
}

export function ReportButton({ itemKey, className }: { itemKey: string; className?: string }) {
  const s = strings.use()
  const c = common.use()
  const report = useProgress((st) => st.report)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <>
      <Button variant="ghost" size="xs" className={cn('text-muted-foreground', className)} onClick={() => setOpen(true)}>
        <Flag /> {c.actions.report}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setSent(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{s.reportTitle}</DialogTitle>
            <DialogDescription>{s.reportBody}</DialogDescription>
          </DialogHeader>
          {sent ? (
            <p className="text-success">{s.thanks}</p>
          ) : (
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus />
          )}
          <DialogFooter>
            {!sent && (
              <Button
                disabled={!text.trim()}
                onClick={() => {
                  report(itemKey, text.trim())
                  setText('')
                  setSent(true)
                }}
              >
                {s.send}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface WordCardProps {
  concept: Concept
  lang: TargetLang
  /** Show the meaning (hidden while the learner still has to answer). */
  showMeaning?: boolean
  autoPlay?: boolean
  size?: 'md' | 'lg'
  className?: string
}

/** Everything worth knowing about a word: form, pronunciation, meaning, notes, related forms, sources. */
export function WordCard({ concept, lang, showMeaning = true, autoPlay = false, size = 'lg', className }: WordCardProps) {
  const s = strings.use()
  const l = useLocalize()
  const compare = useSettings((st) => st.compare)
  const entry = concept[lang]
  if (!entry) return null
  const other: TargetLang = lang === 'ckb' ? 'fa' : 'ckb'
  const otherEntry = concept[other]
  const ev = evidenceFor('concept', lang, concept.id)
  const audioUrl = entry.audio?.[0]?.url ?? ev.audio

  return (
    <div className={cn('flex flex-col items-center gap-4 text-center', className)}>
      {concept.emoji && <div className={cn(size === 'lg' ? 'text-5xl' : 'text-3xl')} aria-hidden>{concept.emoji}</div>}
      <div className="flex flex-col items-center gap-1">
        <TargetText
          lang={lang}
          text={entry.primary.script}
          latin={entry.primary.latin}
          size={size === 'lg' ? '2xl' : 'xl'}
          audio
          audioUrl={audioUrl}
          autoPlay={autoPlay}
        />
        <div className="flex items-center gap-1">
          <RegisterBadge form={entry.primary} />
          <EvidenceBadge kind="concept" lang={lang} id={concept.id} showLabel />
        </div>
      </div>

      {showMeaning && (
        <div className="space-y-1">
          <p className="text-2xl font-semibold">{l(concept.gloss)}</p>
          {concept.senseNote && <p className="text-sm text-muted-foreground">{l(concept.senseNote)}</p>}
        </div>
      )}

      {showMeaning && entry.notes && (
        <p className="max-w-prose rounded-xl bg-muted/70 px-4 py-3 text-start text-sm leading-relaxed">{l(entry.notes)}</p>
      )}

      {showMeaning && (entry.variants?.length || entry.plural) && (
        <div className="w-full max-w-md space-y-2 text-start">
          {entry.variants?.length ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.alsoSaid}</p>
              <ul className="space-y-1">
                {entry.variants.map((v) => (
                  <li key={v.script} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      <RegisterBadge form={v} />
                      {v.note && <span className="text-xs text-muted-foreground">{l(v.note)}</span>}
                    </span>
                    <TargetText lang={lang} text={v.script} latin={v.latin} size="sm" align="start" className="items-end" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {entry.plural && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.plural}</span>
              <TargetText lang={lang} text={entry.plural.script} latin={entry.plural.latin} size="sm" />
            </div>
          )}
        </div>
      )}

      {showMeaning && compare && otherEntry && (
        <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {concept.cognate && <Link2 className="size-3.5" aria-label={s.cognate} />}
            {s.inOther[other]}
          </span>
          <TargetText lang={other} text={otherEntry.primary.script} latin={otherEntry.primary.latin} size="sm" audio />
        </div>
      )}

      {showMeaning && <ReportButton itemKey={`concept:${lang}:${concept.id}`} />}
    </div>
  )
}
