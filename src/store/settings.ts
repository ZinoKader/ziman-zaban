import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BaseLang, TargetLang } from '@/content/types'
import { deviceStorage } from './device-storage'

/**
 * How romanization is shown next to Arabic script.
 * `always` while learning the script, `tap` to make reading effortful, `never` once fluent.
 */
export type RomanizationMode = 'always' | 'tap' | 'never'

export type Settings = {
  baseLang: BaseLang
  targetLang: TargetLang
  romanization: RomanizationMode
  /** Show the Arabic script under the romanization. Off by default; learners open it when they want it. */
  showScript: boolean
  /** Show the same word in the other target language on word cards. */
  compare: boolean
  /** Preferred input for typed answers. Both are always accepted. */
  answerScript: 'arabic' | 'latin'
  /** Recall: pick the word among four options, type it, or say it aloud and grade yourself. */
  recallAnswer: 'choose' | 'type' | 'say'
  newPerSession: number
  sessionSize: number
  autoplayAudio: boolean
  theme: 'light' | 'dark' | 'system'
  onboarded: boolean
  /** Date (YYYY-MM-DD) of the newest changelog entry the learner has seen. */
  changelogSeen: string | null
  accountPromptHiddenAt: string | null
}

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void
}

export const DEFAULT_SETTINGS: Settings = {
  baseLang: 'en',
  targetLang: 'ckb',
  romanization: 'always',
  showScript: false,
  compare: true,
  answerScript: 'latin',
  recallAnswer: 'choose',
  newPerSession: 6,
  sessionSize: 15,
  autoplayAudio: true,
  theme: 'system',
  onboarded: false,
  changelogSeen: null,
  accountPromptHiddenAt: null,
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
    }),
    {
      name: 'zz-settings',
      version: 2,
      storage: createJSONStorage(() => deviceStorage),
      partialize: ({ set: _set, ...rest }) => rest,
      migrate: (persisted, version) => {
        const s = persisted as Partial<Settings>
        // Typing was the default before options were; nobody had to pick it.
        if (version < 2 && s.recallAnswer === 'type') s.recallAnswer = 'choose'
        return s as SettingsState
      },
    },
  ),
)
