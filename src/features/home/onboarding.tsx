import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { BaseLang, TargetLang } from '@/content/types'
import { defineStrings } from '@/i18n'
import { cn } from '@/lib/utils'
import { useSettings, type RomanizationMode } from '@/store/settings'

const strings = defineStrings({
  en: {
    welcome: 'Welcome! Three quick questions.',
    base: 'Which language should explanations be in?',
    target: 'Which language do you want to start with? You can switch any time.',
    script: 'Can you read Arabic script?',
    scriptOptions: {
      always: ['Not yet', "We'll show Latin letters under every word. Learn the letters in Alphabet when you're ready."],
      tap: ['A little', 'Latin letters are hidden; tap a word to see them.'],
      never: ['Yes', 'Arabic script only.'],
    },
    go: 'Start learning',
  },
  sv: {
    welcome: 'Välkommen! Tre snabba frågor.',
    base: 'Vilket språk ska förklaringarna vara på?',
    target: 'Vilket språk vill du börja med? Du kan byta när som helst.',
    script: 'Kan du läsa arabisk skrift?',
    scriptOptions: {
      always: ['Inte än', 'Vi visar latinska bokstäver under varje ord. Lär dig bokstäverna under Alfabet när du är redo.'],
      tap: ['Lite', 'Latinska bokstäver är dolda; tryck på ett ord för att se dem.'],
      never: ['Ja', 'Bara arabisk skrift.'],
    },
    go: 'Börja lära dig',
  },
})

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex-1 rounded-2xl border-2 bg-card px-4 py-3 text-start transition hover:border-primary/50',
        selected && 'border-primary bg-primary/5 ring-4 ring-primary/10',
      )}
    >
      {children}
    </button>
  )
}

export function Onboarding() {
  const settings = useSettings()
  const s = strings.get(settings.baseLang)
  const [target, setTarget] = useState<TargetLang>(settings.targetLang)
  const [rom, setRom] = useState<RomanizationMode>(settings.romanization)

  return (
    <Card className="animate-pop-in border-2 border-primary/20">
      <CardContent className="space-y-6">
        <h2 className="text-xl font-semibold">{s.welcome}</h2>
        <section className="space-y-2">
          <p className="font-medium">{s.base}</p>
          <div className="flex gap-2">
            {(['en', 'sv'] as BaseLang[]).map((b) => (
              <Choice key={b} selected={settings.baseLang === b} onClick={() => settings.set({ baseLang: b })}>
                <span className="text-lg font-medium">{b === 'en' ? 'English' : 'Svenska'}</span>
              </Choice>
            ))}
          </div>
        </section>
        <section className="space-y-2">
          <p className="font-medium">{s.target}</p>
          <div className="flex gap-2">
            {(['ckb', 'fa'] as TargetLang[]).map((t) => (
              <Choice key={t} selected={target === t} onClick={() => setTarget(t)}>
                <span lang={t} className="block font-script text-2xl">{t === 'ckb' ? 'کوردیی ناوەندی' : 'فارسی'}</span>
                <span className="text-sm text-muted-foreground">
                  {t === 'ckb' ? (settings.baseLang === 'sv' ? 'Soranikurdiska' : 'Sorani Kurdish') : settings.baseLang === 'sv' ? 'Persiska' : 'Persian'}
                </span>
              </Choice>
            ))}
          </div>
        </section>
        <section className="space-y-2">
          <p className="font-medium">{s.script}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(['always', 'tap', 'never'] as RomanizationMode[]).map((m) => (
              <Choice key={m} selected={rom === m} onClick={() => setRom(m)}>
                <span className="block font-medium">{s.scriptOptions[m][0]}</span>
                <span className="text-xs text-muted-foreground">{s.scriptOptions[m][1]}</span>
              </Choice>
            ))}
          </div>
        </section>
        <Button
          size="xl"
          className="w-full"
          onClick={() => settings.set({ targetLang: target, romanization: rom, answerScript: rom === 'never' ? 'arabic' : 'latin', onboarded: true })}
        >
          {s.go}
        </Button>
      </CardContent>
    </Card>
  )
}
