import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { failureCode, openMic, unlockAudio } from './mic'

class FakeContext {
  state = 'suspended'
  sampleRate = 48_000
  resume = vi.fn(async () => {
    this.state = 'running'
  })
}

describe('openMic', () => {
  const session = { type: 'auto' }
  beforeEach(() => {
    session.type = 'auto'
    vi.stubGlobal('AudioContext', FakeContext)
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'audioSession')
    Reflect.deleteProperty(navigator, 'mediaDevices')
  })

  it('records as a call, so silent mode on an iPhone does not mute the microphone', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true })
    unlockAudio()
    expect(session.type).toBe('play-and-record')
  })

  it('reports a refused permission and gives the audio session back', async () => {
    const refuse = vi.fn(async () => {
      throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
    })
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: refuse }, configurable: true })
    const err = await openMic(() => {}).catch((e: unknown) => e)
    expect(failureCode(err)).toBe('denied')
    expect((err as Error).message).toBe('NotAllowedError: Permission denied')
    expect(session.type).toBe('auto')
  })

  it('tells a busy microphone from a missing one', async () => {
    for (const [name, code] of [
      ['NotReadableError', 'busy'],
      ['NotFoundError', 'nodevice'],
    ]) {
      const fail = vi.fn(async () => {
        throw Object.assign(new Error('x'), { name })
      })
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: fail }, configurable: true })
      expect(failureCode(await openMic(() => {}).catch((e: unknown) => e))).toBe(code)
    }
  })
})
