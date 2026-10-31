import { Download, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { TargetLang } from '@/content/types'
import { defineStrings } from '@/i18n'
import { common } from '@/i18n/common'
import { useProgress } from '@/store/progress'
import { useSettings, type Settings } from '@/store/settings'

const strings = defineStrings({
  en: {
    title: 'Settings',
    language: 'Languages',
    base: 'Explanations and translations in',
    target: 'Learning',
    display: 'Reading and writing',
    romanization: 'Latin letters (romanization)',
    romanizationOptions: { always: 'Always show', tap: 'Tap to show', never: 'Never show' },
    romanizationHint: 'Hiding romanization once you know the letters makes reading practice more effective.',
    answerScript: 'Default answer keyboard',
    answerScriptOptions: { latin: 'Latin letters', arabic: 'Arabic script (on-screen keyboard)' },
    compare: 'Show the other language on word cards',
    compareHint: 'Sorani and Persian share many words. Seeing both helps you learn two languages at once.',
    audio: 'Play audio automatically',
    practice: 'Practice',
    newPerSession: 'New items per session',
    sessionSize: 'Session length',
    theme: 'Appearance',
    themeOptions: { system: 'Match device', light: 'Light', dark: 'Dark' },
    data: 'Your data',
    dataHint: 'Progress is stored only in this browser. Export it to move to another device.',
    export: 'Export progress',
    import: 'Import progress',
    exportReports: (n: number) => `Export ${n} problem report${n === 1 ? '' : 's'}`,
    reset: (l: string) => `Reset ${l} progress`,
    resetConfirm: 'This deletes all your progress for this language. Continue?',
    imported: 'Progress imported',
    importFailed: 'That file could not be read',
  },
  sv: {
    title: 'Inställningar',
    language: 'Språk',
    base: 'Förklaringar och översättningar på',
    target: 'Jag lär mig',
    display: 'Läsa och skriva',
    romanization: 'Latinska bokstäver (transkription)',
    romanizationOptions: { always: 'Visa alltid', tap: 'Tryck för att visa', never: 'Visa aldrig' },
    romanizationHint: 'Att dölja transkriptionen när du kan bokstäverna gör läsövningen effektivare.',
    answerScript: 'Standardtangentbord för svar',
    answerScriptOptions: { latin: 'Latinska bokstäver', arabic: 'Arabisk skrift (tangentbord på skärmen)' },
    compare: 'Visa det andra språket på ordkort',
    compareHint: 'Sorani och persiska delar många ord. Att se båda hjälper dig att lära dig två språk samtidigt.',
    audio: 'Spela upp ljud automatiskt',
    practice: 'Övning',
    newPerSession: 'Nya per pass',
    sessionSize: 'Passets längd',
    theme: 'Utseende',
    themeOptions: { system: 'Som enheten', light: 'Ljust', dark: 'Mörkt' },
    data: 'Dina data',
    dataHint: 'Framstegen sparas bara i den här webbläsaren. Exportera dem för att flytta till en annan enhet.',
    export: 'Exportera framsteg',
    import: 'Importera framsteg',
    exportReports: (n: number) => `Exportera ${n} felrapport${n === 1 ? '' : 'er'}`,
    reset: (l: string) => `Nollställ framsteg i ${l}`,
    resetConfirm: 'Detta raderar alla dina framsteg för språket. Fortsätta?',
    imported: 'Framstegen importerades',
    importFailed: 'Filen kunde inte läsas',
  },
})

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

export function SettingsPage() {
  const s = strings.use()
  const c = common.use()
  const settings = useSettings()
  const progress = useProgress()
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
          <Row label={s.answerScript}>
            <Choice k="answerScript" options={s.answerScriptOptions} />
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

      <Card>
        <CardHeader>
          <CardTitle>{s.data}</CardTitle>
          <CardDescription>{s.dataHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => download('ziman-zaban-progress.json', { cards: progress.cards, log: progress.log, days: progress.days })}>
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
                const data = JSON.parse(await file.text())
                if (typeof data.cards !== 'object' || !Array.isArray(data.log)) throw new Error('bad file')
                progress.importState({ cards: data.cards, log: data.log, days: data.days ?? {} })
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
                if (confirm(s.resetConfirm)) progress.resetLanguage(l)
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
