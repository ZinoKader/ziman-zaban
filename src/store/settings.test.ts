import { DEFAULT_SETTINGS, useSettings } from './settings'

beforeEach(() => useSettings.setState(DEFAULT_SETTINGS))

describe('useSettings', () => {
  it('starts from the defaults', () => {
    const { set: _set, ...state } = useSettings.getState()
    expect(state).toEqual(DEFAULT_SETTINGS)
  })

  it('set() merges a partial patch', () => {
    useSettings.getState().set({ baseLang: 'sv', romanization: 'tap' })
    const s = useSettings.getState()
    expect(s).toMatchObject({ ...DEFAULT_SETTINGS, baseLang: 'sv', romanization: 'tap' })
    useSettings.getState().set({ targetLang: 'fa' })
    expect(useSettings.getState()).toMatchObject({ baseLang: 'sv', romanization: 'tap', targetLang: 'fa' })
  })

  it('persists values but not the setter', () => {
    useSettings.getState().set({ answerScript: 'arabic', sessionSize: 20 })
    const stored = JSON.parse(localStorage.getItem('zz-settings')!)
    expect(stored.state).toEqual({ ...DEFAULT_SETTINGS, answerScript: 'arabic', sessionSize: 20 })
    expect(stored.state).not.toHaveProperty('set')
  })

  it('rehydrates persisted values and keeps defaults for missing ones', async () => {
    localStorage.setItem('zz-settings', JSON.stringify({ state: { baseLang: 'sv', compare: false }, version: 1 }))
    await useSettings.persist.rehydrate()
    const s = useSettings.getState()
    expect(s).toMatchObject({ ...DEFAULT_SETTINGS, baseLang: 'sv', compare: false })
    expect(typeof s.set).toBe('function')
  })
})
