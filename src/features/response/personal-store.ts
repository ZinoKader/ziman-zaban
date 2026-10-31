import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { QAItem, TargetLang } from '@/content/types'
import { slotNames, type SlotValue } from './template'

export interface PersonalValue {
  /** In Sorani/Persian script; may be empty when only Latin was given. */
  text: string
  latin: string
}

/*
 * The learner's own answers to personal questions (their name, where they live...).
 * Values are kept per language and question: the same slot name can mean different
 * things in different questions ({place} in "where are you from" vs "where do you live",
 * {name} in "your name" vs "your mother's name").
 */
interface PersonalState {
  values: Record<string, PersonalValue>
  setValue: (key: string, value: PersonalValue) => void
  clearValue: (key: string) => void
}

export function personalKey(lang: TargetLang, itemId: string, slot: string): string {
  return `${lang}:${itemId}:${slot}`
}

export const usePersonal = create<PersonalState>()(
  persist(
    (set) => ({
      values: {},
      setValue: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
      clearValue: (key) =>
        set((s) => {
          const { [key]: _removed, ...rest } = s.values
          return { values: rest }
        }),
    }),
    {
      name: 'zz-personal',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ values }) => ({ values }),
    },
  ),
)

/** The learner's saved values for this question's slots. */
export function useOwnValues(lang: TargetLang, item: QAItem): Record<string, SlotValue | undefined> {
  const values = usePersonal((s) => s.values)
  const slots = new Set((item[lang]?.answers ?? []).flatMap((a) => slotNames(a.text)))
  const out: Record<string, SlotValue | undefined> = {}
  for (const slot of slots) out[slot] = values[personalKey(lang, item.id, slot)]
  return out
}

/** Values the learner already saved for a slot of the same name in other questions, newest wins on duplicates. */
export function otherValuesForSlot(values: Record<string, PersonalValue>, lang: TargetLang, slot: string): PersonalValue[] {
  const seen = new Set<string>()
  return Object.entries(values)
    .filter(([k]) => k.startsWith(`${lang}:`) && k.endsWith(`:${slot}`))
    .map(([, v]) => v)
    .filter((v) => {
      const id = `${v.text}|${v.latin}`
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
}
