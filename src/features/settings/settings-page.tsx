import { Download, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { backupOf, parseBackup } from '@/data/backup'
import { fetchReviews } from '@/data/progress-api'
import { SaveDetails } from '@/features/progress/save-indicator'
import { useImportBackup, useProgress, useResetLanguage } from '@/store/progress'
import { useSettings, type Settings } from '@/store/settings'
import { AccountCard } from './account-card'
import { settingsStrings as strings } from './strings'

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <Label className="text-sm">{label}</Label>
        {hint && <p className="max-w-md text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Choice<K extends keyof Settings>({ k, options }: { k: K; options: Record<string, string> }) {
  const value = useSettings((s) => s[k])
  const set = useSettings((s) => s.set)
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => set({ [k]: (typeof value === 'number' ? Number(v) : v) as Settings[K] } as Partial<Settings>)}
    >
      <SelectTrigger className="w-60">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-sm text-muted-foreground">{children}</dd>
    </div>
  )
}

function DataFacts() {
  const s = strings.use()
  const cards = useProgress((st) => Object.keys(st.cards).length)
  const days = useProgress((st) => Object.values(st.days))
  const reviews = days.reduce((n, d) => n + d.reviews, 0)
  const practised = days.filter((d) => d.reviews > 0).length

  return (
    <dl className="divide-y">
      <Fact label={s.contents}>{s.contentsValue(cards, reviews, practised)}</Fact>
      <Fact label={s.saving}>
        <SaveDetails />
      </Fact>
    </dl>
  )
}

function useScrollToHash() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])
}

export function SettingsPage() {
  useScrollToHash()
  const s = strings.use()
  const c = common.use()
  const settings = useSettings()
  const progress = useProgress((st) => st)
  const importBackup = useImportBackup()
  const resetLanguage = useResetLanguage()
  const fileInput = useRef<HTMLInputElement>(null)
  const numbers = (values: number[]) => Object.fromEntries(values.map((n) => [String(n), String(n)]))

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-10">
      <h1 className="text-3xl font-semibold">{s.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{s.language}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label={s.base}>
            <Choice k="baseLang" options={{ en: 'English', sv: 'Svenska' }} />
          </Row>
          <Row label={s.target}>
            <Choice k="targetLang" options={{ ckb: c.languages.ckb, fa: c.languages.fa }} />
          </Row>
          <Row label={s.compare} hint={s.compareHint}>
            <Switch checked={settings.compare} onCheckedChange={(v) => settings.set({ compare: v })} />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{s.display}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label={s.romanization} hint={s.romanizationHint}>
            <Choice k="romanization" options={s.romanizationOptions} />
          </Row>
          {settings.romanization === 'always' && (
            <Row label={s.showScript} hint={s.showScriptHint}>
              <Switch checked={settings.showScript} onCheckedChange={(v) => settings.set({ showScript: v })} />
            </Row>
          )}
          <Row label={s.answerScript}>
            <Choice k="answerScript" options={s.answerScriptOptions} />
          </Row>
          <Row label={s.recallAnswer} hint={s.recallAnswerHint}>
            <Choice k="recallAnswer" options={s.recallAnswerOptions} />
          </Row>
          <Row label={s.audio}>
            <Switch checked={settings.autoplayAudio} onCheckedChange={(v) => settings.set({ autoplayAudio: v })} />
          </Row>
          <Row label={s.theme}>
            <Choice k="theme" options={s.themeOptions} />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{s.practice}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label={s.newPerSession}>
            <Choice k="newPerSession" options={numbers([3, 5, 6, 8, 10, 15])} />
          </Row>
          <Row label={s.sessionSize}>
            <Choice k="sessionSize" options={numbers([10, 15, 20, 30, 50])} />
          </Row>
        </CardContent>
      </Card>

      <AccountCard />

      <Card id="data" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>{s.data}</CardTitle>
          <CardDescription>{s.dataHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataFacts />
        </CardContent>
        <CardContent className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                download('ziman-zaban-progress.json', backupOf(progress, await fetchReviews()))
              } catch {
                toast.error(s.exportFailed)
              }
            }}
          >
            <Download /> {s.export}
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload /> {s.import}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const backup = parseBackup(await file.text())
                if (!backup) throw new Error('bad file')
                await importBackup(backup, settings.targetLang)
                toast.success(s.imported)
              } catch {
                toast.error(s.importFailed)
              }
              e.target.value = ''
            }}
          />
          {progress.reports.length > 0 && (
            <Button variant="outline" onClick={() => download('ziman-zaban-reports.json', { reports: progress.reports })}>
              <Download /> {s.exportReports(progress.reports.length)}
            </Button>
          )}
          {(['ckb', 'fa'] as TargetLang[]).map((l) => (
            <Button
              key={l}
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                if (confirm(s.resetConfirm)) resetLanguage(l)
              }}
            >
              <Trash2 /> {s.reset(c.languagesShort[l])}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
