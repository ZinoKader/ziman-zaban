import { Pencil, Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { TargetText } from '@/components/target-text'
import { Button } from '@/components/ui/button'
import type { QAAnswer, QAForm, QAItem, TargetLang } from '@/content/types'
import { useLocalize } from '@/i18n'
import { isArabicScript } from '@/lib/script/normalize'
import { cn } from '@/lib/utils'
import { otherValuesForSlot, personalKey, useOwnValues, usePersonal, type PersonalValue } from '../personal-store'
import { responseStrings } from '../strings'
import { fillAnswer, slotNames } from '../template'
import { PatternText } from './model-answers'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface MakeItYoursProps {
  item: QAItem
  form: QAForm
  lang: TargetLang
  template: QAAnswer
  /** Slot values taken from the learner's typed answer, offered as a starting point. */
  prefill?: Record<string, PersonalValue> | null
}

/** Personal questions: the learner fills in their own answer once and the model answer uses it from then on. */
export function MakeItYours({ item, form, lang, template, prefill }: MakeItYoursProps) {
  const s = responseStrings.use()
  const l = useLocalize()
  const values = usePersonal((st) => st.values)
  const setValue = usePersonal((st) => st.setValue)
  const own = useOwnValues(lang, item)
  const slots = [...new Set(slotNames(template.text))]
  const complete = slots.every((slot) => own[slot])
  const [editing, setEditing] = useState(!complete)
  const [draft, setDraft] = useState<Record<string, PersonalValue>>(() =>
    Object.fromEntries(
      slots.map((slot) => {
        const start = own[slot] ?? prefill?.[slot]
        return [slot, { text: start?.text ?? '', latin: start?.latin ?? '' }]
      }),
    ),
  )
  const baseId = useId()
  const ready = slots.every((slot) => draft[slot]?.text.trim() || draft[slot]?.latin.trim())

  const save = () => {
    if (!ready) return
    for (const slot of slots) {
      const v = draft[slot]
      setValue(personalKey(lang, item.id, slot), { text: v.text.trim(), latin: v.latin.trim() })
    }
    setEditing(false)
  }

  const filled = fillAnswer(template, own)

  return (
    <section className="space-y-3 rounded-xl border border-mod-response/30 bg-mod-response/5 p-3 sm:p-4" aria-labelledby={`${baseId}-title`}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${baseId}-title`} className="flex items-center gap-1.5 text-sm font-semibold text-mod-response">
          <Sparkles className="size-4" />
          {s.makeItYours}
        </h3>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            {s.change}
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.yourVersion}</span>
          <TargetText lang={lang} text={filled.text} latin={filled.latin} size="md" audio romanization="always" />
          <p className="text-sm text-muted-foreground">{l(filled.translation)}</p>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <p className="text-sm text-muted-foreground">{s.makeItYoursHint}</p>
          <div className="flex justify-center">
            <PatternText text={template.text} lang={lang} />
          </div>
          {slots.map((slot) => {
            const d = draft[slot] ?? { text: '', latin: '' }
            const set = (patch: Partial<PersonalValue>) => setDraft((prev) => ({ ...prev, [slot]: { ...d, ...patch } }))
            const suggestions = [
              ...otherValuesForSlot(values, lang, slot),
              ...(form.slots?.[slot] ?? []).map((v) => ({ text: v.text, latin: v.latin })),
            ].filter((v, i, all) => all.findIndex((w) => w.text === v.text && w.latin === v.latin) === i)
            return (
              <fieldset key={slot} className="space-y-2">
                <legend className="mb-1 text-sm font-medium">{capitalize(s.slotLabels[slot] ?? slot)}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{s.scriptLabel}</span>
                    <input
                      value={d.text}
                      onChange={(e) => set({ text: e.target.value })}
                      dir="rtl"
                      lang={lang}
                      autoComplete="off"
                      spellCheck={false}
                      className={cn(
                        'h-11 w-full rounded-lg border-2 bg-card px-3 font-script text-lg outline-none transition',
                        'focus:border-primary focus:ring-4 focus:ring-primary/15',
                        d.text && !isArabicScript(d.text) && 'border-warning',
                      )}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{s.latinLabel}</span>
                    <input
                      value={d.latin}
                      onChange={(e) => set({ latin: e.target.value })}
                      lang={`${lang}-Latn`}
                      autoComplete="off"
                      spellCheck={false}
                      className="h-11 w-full rounded-lg border-2 bg-card px-3 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                    />
                  </label>
                </div>
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{s.pickOne}:</span>
                    {suggestions.slice(0, 6).map((v) => (
                      <button
                        key={`${v.text}|${v.latin}`}
                        type="button"
                        onClick={() => set({ text: v.text, latin: v.latin })}
                        className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-sm transition hover:border-primary/60 hover:bg-primary/5"
                      >
                        {v.text && (
                          <span dir="rtl" lang={lang} className="font-script">
                            {v.text}
                          </span>
                        )}
                        {v.latin && <span className="text-xs text-muted-foreground">{v.latin}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </fieldset>
            )
          })}
          <Button type="submit" variant="secondary" className="w-full" disabled={!ready}>
            {s.save}
          </Button>
        </form>
      )}
    </section>
  )
}
