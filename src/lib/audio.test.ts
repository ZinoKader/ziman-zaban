import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clipFor,
  clipUrl,
  loadAudioManifest,
  setAudioManifest,
  SLOW_RATE,
  speak,
  stopAudio,
  useCanPlay,
  useHasClip,
  type AudioManifest,
} from './audio'

const MANIFEST: AudioManifest = {
  ckb: {
    'ناوت چییە؟': { f: 'ckb/aaaaaaaaaaaaaaaa.mp3', v: 'ckb-audio8', q: 0 },
    'باشم.': { f: 'ckb/bbbbbbbbbbbbbbbb.mp3', v: 'ckb-audio8' },
  },
  fa: {
    'سلام': { f: 'fa/cccccccccccccccc.mp3', v: 'fa-dilara' },
  },
  voices: {
    'ckb-audio8': { name: 'Audio8 Sorani', engine: 'Audio8 TTS (DualAR)', license: 'CC BY-NC 4.0', credit: 'Audio8-TTS-Kurdish-Sorani' },
    'fa-dilara': { name: 'Dilara', engine: 'Microsoft neural TTS', license: 'Azure', credit: 'Microsoft' },
  },
}

let played: Array<{ src: string; rate: number; preservesPitch: boolean }>
let failing: Set<string>

beforeEach(() => {
  played = []
  failing = new Set()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    if ([...failing].some((f) => this.src.endsWith(f))) return Promise.reject(new DOMException('no', 'NotSupportedError'))
    played.push({ src: this.src, rate: this.playbackRate, preservesPitch: this.preservesPitch })
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  setAudioManifest(MANIFEST)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  setAudioManifest(null)
})

describe('clipFor', () => {
  it('finds clips by canonical text', () => {
    expect(clipFor('ckb', 'ناوت چييە؟')?.f).toBe('ckb/aaaaaaaaaaaaaaaa.mp3')
    expect(clipFor('fa', ' سلام ')?.f).toBe('fa/cccccccccccccccc.mp3')
  })

  it('ignores final punctuation in either direction', () => {
    expect(clipFor('ckb', 'ناوت چییە')?.f).toBe('ckb/aaaaaaaaaaaaaaaa.mp3')
    expect(clipFor('ckb', 'باشم')?.f).toBe('ckb/bbbbbbbbbbbbbbbb.mp3')
    expect(clipFor('fa', 'سلام!')?.f).toBe('fa/cccccccccccccccc.mp3')
  })

  it('keeps languages apart and returns nothing without a manifest', () => {
    expect(clipFor('fa', 'باشم.')).toBeUndefined()
    setAudioManifest(null)
    expect(clipFor('ckb', 'باشم.')).toBeUndefined()
  })
})

describe('speak', () => {
  it('prefers an explicit recording', async () => {
    expect(await speak({ lang: 'fa', text: 'سلام', url: 'https://example.org/rec.mp3' })).toBe(true)
    expect(played.map((p) => p.src)).toEqual(['https://example.org/rec.mp3'])
  })

  it('falls back to the generated clip when the recording fails', async () => {
    failing.add('rec.mp3')
    expect(await speak({ lang: 'fa', text: 'سلام', url: 'https://example.org/rec.mp3' })).toBe(true)
    expect(played).toHaveLength(1)
    expect(played[0].src).toContain(clipUrl(MANIFEST.fa['سلام']))
  })

  it('plays slow clips with pitch preserved', async () => {
    await speak({ lang: 'ckb', text: 'باشم.', rate: SLOW_RATE })
    expect(played[0]).toMatchObject({ rate: SLOW_RATE, preservesPitch: true })
  })

  it('uses browser speech synthesis when there is no clip', async () => {
    const spoken: SpeechSynthesisUtterance[] = []
    const voice = { lang: 'fa-IR', name: 'Dariush' } as SpeechSynthesisVoice
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [voice],
      speak: (u: SpeechSynthesisUtterance) => spoken.push(u),
      cancel: () => {},
    })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string
        voice?: SpeechSynthesisVoice
        lang = ''
        rate = 1
        constructor(text: string) {
          this.text = text
        }
      },
    )
    expect(await speak({ lang: 'fa', text: 'خداحافظ' })).toBe(true)
    expect(played).toHaveLength(0)
    expect(spoken[0].text).toBe('خداحافظ')
  })

  it('resolves false when nothing can play', async () => {
    expect(await speak({ lang: 'ckb', text: 'خوداحافیز' })).toBe(false)
  })

  it('does not fall back when a newer call superseded it', async () => {
    let release: () => void = () => {}
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(
      () => new Promise<void>((_, reject) => (release = () => reject(new DOMException('aborted', 'AbortError')))),
    )
    const first = speak({ lang: 'fa', text: 'سلام', url: 'https://example.org/slow.mp3' })
    stopAudio()
    release()
    expect(await first).toBe(false)
    expect(played).toHaveLength(0)
  })
})

describe('manifest loading', () => {
  it('fetches the manifest once and notifies hooks', async () => {
    setAudioManifest(null)
    let resolve: (v: unknown) => void = () => {}
    const fetchMock = vi.fn((_url: string) => new Promise((r) => (resolve = r)))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => ({
      clip: useHasClip('ckb', 'باشم'),
      any: useHasClip('ckb'),
      can: useCanPlay('ckb', 'باشم'),
    }))
    expect(result.current).toEqual({ clip: false, any: false, can: false })
    void loadAudioManifest()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ ok: true, json: async () => MANIFEST }))
    expect(result.current).toEqual({ clip: true, any: true, can: true })
    expect(fetchMock.mock.calls[0][0]).toMatch(/audio\/manifest\.json$/)
  })

  it('survives a missing manifest', async () => {
    setAudioManifest(null)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    expect(await loadAudioManifest()).toBeNull()
    expect(clipFor('ckb', 'باشم.')).toBeUndefined()
  })
})
