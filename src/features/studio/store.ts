import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { TextKind } from '@/content/audio-texts'
import type { TargetLang } from '@/content/types'
import type { PromptGroup } from './prompts'
import { deleteAudio, saveAudio } from './takes-db'

export interface TakeMeta {
  lang: TargetLang
  text: string
  latin: string
  kind: TextKind
  recordedAt: string
  durationMs: number
  peakDb: number
}

export const takeKey = (lang: TargetLang, text: string) => `${lang}:${text}`

interface StudioState {
  speaker: string
  lang: TargetLang | null
  /** When the speaker agreed to how recordings are used. Recording needs it. */
  consentAt: string | null
  group: PromptGroup
  /** One take per text, keyed by `takeKey`. A new take replaces the old one. The audio is in IndexedDB. */
  takes: Record<string, TakeMeta>
  setup: (speaker: string, lang: TargetLang, now?: Date) => void
  setGroup: (group: PromptGroup) => void
  addTake: (meta: TakeMeta, wav: Uint8Array<ArrayBuffer>) => Promise<void>
  removeTakes: (keys: string[]) => Promise<void>
  clear: (lang: TargetLang) => Promise<void>
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      speaker: '',
      lang: null,
      consentAt: null,
      group: 'words',
      takes: {},
      setup: (speaker, lang, now = new Date()) => set({ speaker: speaker.trim(), lang, consentAt: get().consentAt ?? now.toISOString() }),
      setGroup: (group) => set({ group }),
      addTake: async (meta, wav) => {
        const key = takeKey(meta.lang, meta.text)
        set((s) => ({ takes: { ...s.takes, [key]: meta } }))
        await saveAudio(key, wav)
      },
      removeTakes: async (keys) => {
        set((s) => ({ takes: Object.fromEntries(Object.entries(s.takes).filter(([k]) => !keys.includes(k))) }))
        await deleteAudio(keys)
      },
      clear: async (lang) => {
        const keys = Object.keys(get().takes).filter((k) => get().takes[k].lang === lang)
        await get().removeTakes(keys)
      },
    }),
    { name: 'zz-studio', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)

export function takesFor(takes: Record<string, TakeMeta>, lang: TargetLang): TakeMeta[] {
  return Object.values(takes)
    .filter((t) => t.lang === lang)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
}
