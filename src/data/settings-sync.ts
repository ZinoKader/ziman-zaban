import { safeLocalStorage } from '@/store/device-storage'
import { DEFAULT_SETTINGS, useSettings, type Settings } from '@/store/settings'
import { fetchSettings, saveSettings } from './progress-api'

export const SETTINGS_AT_KEY = 'zz-settings-at'
const DELAY_MS = 800

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]

export function settingsOf(s: Settings): Settings {
  return Object.fromEntries(KEYS.map((k) => [k, s[k]])) as Settings
}

function known(saved: Partial<Settings>): Partial<Settings> {
  return Object.fromEntries(Object.entries(saved).filter(([k]) => (KEYS as string[]).includes(k)))
}

let applying = false

function apply(saved: Partial<Settings>) {
  applying = true
  try {
    useSettings.getState().set(known(saved))
  } finally {
    applying = false
  }
}

export async function pullSettings({ preferServer = false, local = safeLocalStorage() } = {}) {
  const saved = await fetchSettings()
  const localAt = local?.getItem(SETTINGS_AT_KEY) ?? null
  const current = settingsOf(useSettings.getState())
  if (!saved) return saveSettings(current, localAt ?? undefined)
  const serverNewer = !!saved.changedAt && (!localAt || saved.changedAt > localAt)
  if (preferServer || serverNewer) {
    apply(saved.settings)
    if (saved.changedAt) local?.setItem(SETTINGS_AT_KEY, saved.changedAt)
  } else if (localAt) {
    await saveSettings(current, localAt)
  }
}

export function pushSettingsOnChange({ local = safeLocalStorage(), delay = DELAY_MS } = {}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsub = useSettings.subscribe(() => {
    if (applying) return
    const at = new Date().toISOString()
    local?.setItem(SETTINGS_AT_KEY, at)
    clearTimeout(timer)
    timer = setTimeout(() => void saveSettings(settingsOf(useSettings.getState()), at).catch(() => {}), delay)
  })
  return () => {
    clearTimeout(timer)
    unsub()
  }
}
