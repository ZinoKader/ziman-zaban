import { Mic } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TARGET_LANGS, type BaseLang, type TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { useAudioManifest } from '@/lib/audio'
import { cn } from '@/lib/utils'
import { Choice } from '@/features/review/setup-form'
import { NATIVE_NAME } from '@/i18n/native-names'
import { useReview } from '@/features/review/store'
import { useSettings } from '@/store/settings'
import { RECORDING_LICENSE } from './export'
import { promptsFor, promptTotal, type Prompt, type PromptGroup } from './prompts'
import { RecordView } from './record-view'
import { RecordingsPanel } from './recordings-panel'
import { takeKey, useStudio } from './store'
import { studioStrings } from './strings'

function Setup({ onDone }: { onDone: () => void }) {
  const s = studioStrings.use()
  const c = common.use()
  const stored = useStudio()
  const reviewer = useReview((st) => st.reviewer)
  const baseLang = useSettings((st) => st.baseLang)
  const setSettings = useSettings((st) => st.set)
  const [name, setName] = useState(stored.speaker || reviewer)
  const [lang, setLang] = useState<TargetLang | null>(stored.lang)
  const [consent, setConsent] = useState(!!stored.consentAt)
  const nameId = useId()
  const hintId = useId()
  const consentId = useId()
  const ready = !!name.trim() && !!lang && consent
  const isEdit = !!stored.speaker && !!stored.lang

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <div className="mb-6 space-y-3 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Mic className="size-7" />
        </span>
        <h1 className="text-3xl font-semibold text-balance">{s.title}</h1>
        <p className="text-muted-foreground text-pretty">{s.intro}</p>
        <p className="text-sm text-muted-foreground">{s.whoFor}</p>
      </div>
      <form
        className="space-y-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ready) return
          stored.setup(name, lang!)
          onDone()
        }}
      >
        <Choice<BaseLang>
          label={s.uiLang}
          value={baseLang}
          onChange={(v) => setSettings({ baseLang: v })}
          options={[
            { value: 'en', content: <span className="font-medium">English</span> },
            { value: 'sv', content: <span className="font-medium">Svenska</span> },
          ]}
        />
        <Choice<TargetLang>
          label={s.langLabel}
          value={lang}
          onChange={setLang}
          options={TARGET_LANGS.map((l) => ({
            value: l,
            content: (
              <>
                <span lang={l} dir="rtl" className="font-script text-xl">
                  {NATIVE_NAME[l]}
                </span>
                <span className="text-xs text-muted-foreground">{c.languages[l]}</span>
              </>
            ),
          }))}
        />
        <div className="space-y-1.5">
          <Label htmlFor={nameId}>{s.nameLabel}</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={s.namePlaceholder}
            autoComplete="name"
            dir="auto"
            className="h-12 text-base"
            aria-describedby={hintId}
          />
          <p id={hintId} className="text-xs text-muted-foreground">
            {s.nameHint}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id={consentId} checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
          <Label htmlFor={consentId} className="text-sm leading-snug font-normal">
            {s.consent(RECORDING_LICENSE)}
          </Label>
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={!ready}>
          {isEdit ? s.save : s.continue}
        </Button>
      </form>
    </div>
  )
}

const GROUPS: PromptGroup[] = ['words', 'sentences', 'all']

function Studio({ lang, onEdit }: { lang: TargetLang; onEdit: () => void }) {
  const s = studioStrings.use()
  const c = common.use()
  const speaker = useStudio((st) => st.speaker)
  const group = useStudio((st) => st.group)
  const setGroup = useStudio((st) => st.setGroup)
  const takes = useStudio((st) => st.takes)
  const manifest = useAudioManifest()
  const [run, setRun] = useState<Prompt[] | null>(null)

  const prompts = useMemo(
    () => promptsFor(lang, group, (text) => !!manifest?.[lang][text]?.h || !!takes[takeKey(lang, text)]),
    [lang, group, manifest, takes],
  )
  const total = promptTotal(lang, group)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">{s.title}</h1>
          <p className="text-sm text-muted-foreground">
            {s.recordingAs(speaker, c.languages[lang])} ·{' '}
            <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={onEdit}>
              {s.change}
            </button>
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{s.groupLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div role="radiogroup" aria-label={s.groupLabel} className="grid gap-2 sm:grid-cols-3">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={group === g}
                  onClick={() => setGroup(g)}
                  className={cn(
                    'rounded-2xl border-2 bg-card px-3 py-3 text-sm font-medium transition',
                    group === g ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/40',
                  )}
                >
                  {s.groups[g]}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{prompts.length ? s.left(prompts.length, total) : s.allDone}</p>
            <Button size="xl" className="w-full" disabled={!prompts.length} onClick={() => setRun(prompts)}>
              <Mic /> {s.startRecording}
            </Button>
          </CardContent>
        </Card>
        <Card className="h-fit lg:col-span-2">
          <CardHeader>
            <CardTitle>{s.tipsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted-foreground">
              {s.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <RecordingsPanel lang={lang} />

      {run && <RecordView lang={lang} prompts={run} onClose={() => setRun(null)} />}
    </div>
  )
}

export function StudioPage() {
  const lang = useStudio((st) => st.lang)
  const speaker = useStudio((st) => st.speaker)
  const consentAt = useStudio((st) => st.consentAt)
  const [editing, setEditing] = useState(false)
  if (!lang || !speaker || !consentAt || editing) return <Setup onDone={() => setEditing(false)} />
  return <Studio lang={lang} onEdit={() => setEditing(true)} />
}
