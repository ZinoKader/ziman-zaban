import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BaseLang, TargetLang } from '@/content/types'
import { deviceStorage } from './device-storage'

/**
 * How romanization is shown next to Arabic script.
 * `always` while learning the script, `tap` to make reading effortful, `never` once fluent.
 */
export type RomanizationMode = 'always' | 'tap' | 'never'

export interface Settings {
  baseLang: BaseLang
  targetLang: TargetLang
  romanization: RomanizationMode
  /** Show the same word in the other target language on word cards. */
  compare: boolean
  /** Preferred input for typed answers. Both are always accepted. */
  answerScript: 'arabic' | 'latin'
  newPerSession: number
  sessionSize: number
  autoplayAudio: boolean
  theme: 'light' | 'dark' | 'system'
  onboarded: boolean
}

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void
}

export const DEFAULT_SETTINGS: Settings = {
  baseLang: 'en',
  targetLang: 'ckb',
  romanization: 'always',
  compare: true,
  answerScript: 'latin',
  newPerSession: 6,
  sessionSize: 15,
  autoplayAudio: true,
  theme: 'system',
  onboarded: false,
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
    }),
    {
      name: 'zz-settings',
      version: 1,
      storage: createJSONStorage(() => deviceStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
)
