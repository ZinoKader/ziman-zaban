import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '@/store/settings'
import { diagnosticsReport, inAppBrowser, levelVerdict, platformOf, readEnvironment } from './diagnostics'
import { MicCheck } from './mic-check'
import { studioStrings } from './strings'

const mic = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('./mic', async (orig) => ({ ...(await orig<typeof import('./mic')>()), openMic: mic.open, unlockAudio: () => {} }))

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const INSTAGRAM = `${IPHONE} Instagram 350.0.0.0 (iPhone15,2; iOS 18_1)`

describe('diagnostics', () => {
  it('tells iPhones, iPads in desktop mode and Android apart', () => {
    expect(platformOf(IPHONE)).toBe('ios')
    expect(platformOf(IPAD_DESKTOP, 5)).toBe('ios')
    expect(platformOf(IPAD_DESKTOP, 0)).toBe('desktop')
    expect(platformOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0 Mobile Safari/537.36')).toBe('android')
  })

  it('names the app around a built-in browser', () => {
    expect(inAppBrowser(INSTAGRAM)).toBe('Instagram')
    expect(inAppBrowser(IPHONE)).toBeNull()
  })

  it('judges the test word', () => {
    expect(levelVerdict(-12, -80)).toBe('good')
    expect(levelVerdict(-45, -90)).toBe('quiet')
    expect(levelVerdict(0, -80)).toBe('loud')
    expect(levelVerdict(-12, -35)).toBe('noisy')
  })

  it('writes a report with the error and the browser', () => {
    const env = { ...readEnvironment(), ua: IPHONE, platform: 'ios' as const }
    const text = diagnosticsReport(env, { info: null, chunks: 0, floorDb: -100, levelDb: -100, state: 'suspended', errorDetail: 'AudioContext suspended' }, { error: 'blocked' })
    expect(text).toContain(IPHONE)
    expect(text).toContain('Audio state: suspended')
    expect(text).toContain('Error: blocked (AudioContext suspended)')
  })

  it('explains the iPhone microphone setting, in both languages', () => {
    const en = studioStrings.get('en').fixes('denied', 'ios', null)
    expect(en.join(' ')).toMatch(/"aA".*"Website Settings"/)
    const sv = studioStrings.get('sv').fixes('denied', 'ios', 'Instagram')
    expect(sv[0]).toMatch(/Instagram/)
    expect(sv.join(' ')).toMatch(/Webbplatsinställningar/)
  })
})

const SR = 16000
function speech(parts: Array<['sil' | 'say', number]>): Float32Array {
  const out = new Float32Array(parts.reduce((n, [, ms]) => n + (ms * SR) / 1000, 0))
  let i = 0
  for (const [kind, ms] of parts)
    for (let k = 0; k < (ms * SR) / 1000; k++, i++) out[i] = kind === 'say' ? 0.3 * Math.sin((2 * Math.PI * 220 * i) / SR) : ((i % 7) - 3) * 0.0003

  return out
}

describe('MicCheck', () => {
  beforeEach(() => {
    useSettings.setState({ baseLang: 'en' })
    mic.open.mockReset()
    globalThis.URL.createObjectURL ??= () => 'blob:test'
    globalThis.URL.revokeObjectURL ??= () => {}
  })
  afterEach(() => vi.useRealTimers())

  it('shows how to fix a blocked microphone', async () => {
    mic.open.mockRejectedValue(Object.assign(new Error('NotAllowedError: denied'), { code: 'denied' }))
    render(<MicCheck lang="ckb" onReady={() => {}} onClose={() => {}} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start the test/ })))
    expect(screen.getByText('The browser blocked the microphone.')).toBeInTheDocument()
    expect(screen.getByText('How to fix it')).toBeInTheDocument()
    expect(screen.getByText(/Error: denied \(NotAllowedError: denied\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/ })).toBeEnabled()
  })

  it('hears a word, then offers playback and recording', async () => {
    let push: (s: Float32Array) => void = () => {}
    const stop = vi.fn()
    mic.open.mockImplementation(async (onChunk: (s: Float32Array) => void) => {
      push = onChunk
      return { sampleRate: SR, info: { engine: 'worklet', sampleRate: SR, device: 'iPhone Microphone', settings: {} }, state: () => 'running', stop }
    })
    const onReady = vi.fn()
    render(<MicCheck lang="ckb" onReady={onReady} onClose={() => {}} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start the test/ })))
    expect(screen.getByText('سڵاو')).toBeInTheDocument()
    const s = speech([
      ['sil', 600],
      ['say', 500],
      ['sil', 900],
    ])
    act(() => {
      for (let i = 0; i < s.length; i += 128) push(s.subarray(i, i + 128))
    })
    expect(stop).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Listen to yourself/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Start recording/ }))
    expect(onReady).toHaveBeenCalled()
  })
})
