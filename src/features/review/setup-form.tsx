import { ShieldCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TARGET_LANGS, type BaseLang, type TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { useReview } from './store'
import { reviewStrings } from './strings'

const NATIVE_NAME: Record<TargetLang, string> = { ckb: 'کوردیی ناوەندی', fa: 'فارسی' }

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null
  options: Array<{ value: T; content: React.ReactNode }>
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 bg-card px-3 py-2 transition',
              value === o.value ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/40',
            )}
          >
            {o.content}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SetupForm({ onDone }: { onDone: () => void }) {
  const s = reviewStrings.use()
  const c = common.use()
  const storedReviewer = useReview((st) => st.reviewer)
  const storedLang = useReview((st) => st.lang)
  const setup = useReview((st) => st.setup)
  const baseLang = useSettings((st) => st.baseLang)
  const setSettings = useSettings((st) => st.set)
  const [name, setName] = useState(storedReviewer)
  const [lang, setLang] = useState<TargetLang | null>(storedLang)
  const nameId = useId()
  const hintId = useId()
  const ready = !!name.trim() && !!lang
  const isEdit = !!storedReviewer && !!storedLang

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <div className="mb-6 space-y-3 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-7" />
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
          setup(name, lang!)
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
        <Button type="submit" size="xl" className="w-full" disabled={!ready}>
          {isEdit ? s.save : s.start}
        </Button>
      </form>
    </div>
  )
}
