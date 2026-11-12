import { DEFAULT_SETTINGS, useSettings } from '@/store/settings'
import { fetchSettings, saveSettings } from './progress-api'
import { pullSettings, pushSettingsOnChange, SETTINGS_AT_KEY, settingsOf } from './settings-sync'

beforeEach(() => useSettings.setState({ ...DEFAULT_SETTINGS }))

describe('pullSettings', () => {
  it('applies settings changed later on another device', async () => {
    localStorage.setItem(SETTINGS_AT_KEY, '2026-11-01T10:00:00.000Z')
    vi.mocked(fetchSettings).mockResolvedValueOnce({ settings: { theme: 'dark', unknown: 1 } as never, changedAt: '2026-11-02T10:00:00.000Z' })
    await pullSettings({ local: localStorage })
    expect(useSettings.getState().theme).toBe('dark')
    expect(useSettings.getState()).not.toHaveProperty('unknown')
    expect(localStorage.getItem(SETTINGS_AT_KEY)).toBe('2026-11-02T10:00:00.000Z')
    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('sends settings changed later on this device', async () => {
    localStorage.setItem(SETTINGS_AT_KEY, '2026-11-03T10:00:00.000Z')
    vi.mocked(fetchSettings).mockResolvedValueOnce({ settings: { theme: 'dark' }, changedAt: '2026-11-02T10:00:00.000Z' })
    await pullSettings({ local: localStorage })
    expect(useSettings.getState().theme).toBe('system')
    expect(saveSettings).toHaveBeenCalledWith(settingsOf(useSettings.getState()), '2026-11-03T10:00:00.000Z')
  })

  it('takes the account settings after signing in', async () => {
    localStorage.setItem(SETTINGS_AT_KEY, '2026-11-03T10:00:00.000Z')
    vi.mocked(fetchSettings).mockResolvedValueOnce({ settings: { targetLang: 'fa' }, changedAt: '2026-11-02T10:00:00.000Z' })
    await pullSettings({ preferServer: true, local: localStorage })
    expect(useSettings.getState().targetLang).toBe('fa')
  })

  it('creates the profile on first load', async () => {
    vi.mocked(fetchSettings).mockResolvedValueOnce(null)
    await pullSettings({ local: localStorage })
    expect(saveSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS, undefined)
  })
})

describe('pushSettingsOnChange', () => {
  it('saves the last change once, with the time it was made', async () => {
    vi.useFakeTimers()
    try {
      const stop = pushSettingsOnChange({ local: localStorage, delay: 500 })
      useSettings.getState().set({ theme: 'dark' })
      useSettings.getState().set({ sessionSize: 30 })
      vi.advanceTimersByTime(500)
      expect(saveSettings).toHaveBeenCalledTimes(1)
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark', sessionSize: 30 }),
        localStorage.getItem(SETTINGS_AT_KEY),
      )
      stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not send settings it just applied from the server', async () => {
    const stop = pushSettingsOnChange({ local: localStorage, delay: 0 })
    vi.mocked(fetchSettings).mockResolvedValueOnce({ settings: { theme: 'dark' }, changedAt: '2026-11-02T10:00:00.000Z' })
    await pullSettings({ local: localStorage })
    await new Promise((r) => setTimeout(r, 10))
    expect(saveSettings).not.toHaveBeenCalled()
    stop()
  })
})
