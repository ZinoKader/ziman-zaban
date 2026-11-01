import { useEffect, useState, useSyncExternalStore } from 'react'
import type { TargetLang } from '@/content/types'
import { canonicalize } from '@/lib/script/normalize'

/*
 * Pronunciation comes from, in order of preference:
 *  1. a recording attached to the content (native speakers, Wikimedia Commons)
 *  2. a pre-generated neural TTS clip from public/audio (see scripts/audio), looked up by canonical text
 *  3. a speech-synthesis voice installed in the browser/OS for that language
 * All three play through one shared audio element, so starting one stops the previous.
 */

export interface AudioClip {
  /** Path below `audio/`, e.g. `ckb/0a1b2c3d4e5f6a7b.mp3`. */
  f: string
  /** Voice id, a key of `AudioManifest.voices`. */
  v: string
  /** Character error rate of a speech-recognition round trip (0 = recognised perfectly). */
  q?: number
}

export interface AudioVoiceInfo {
  name: string
  engine: string
  license: string
  credit: string
}

export interface AudioManifest {
  ckb: Record<string, AudioClip>
  fa: Record<string, AudioClip>
  voices: Record<string, AudioVoiceInfo>
}

/** Playback rate for "slow" buttons. Time-stretching keeps the pitch natural down to about this speed. */
export const SLOW_RATE = 0.75

const AUDIO_BASE = `${import.meta.env.BASE_URL ?? '/'}audio/`
const TRAILING_PUNCT = /[\s.,!?;:،؛؟…"«»]+$/u
const RETRY_MS = 15_000

let manifest: AudioManifest | null = null
let loose: Record<TargetLang, Map<string, AudioClip>> | null = null
let loading: Promise<AudioManifest | null> | null = null
let failedAt = 0
const listeners = new Set<() => void>()

function setManifest(m: AudioManifest | null) {
  manifest = m
  loose = null
  if (m) {
    loose = { ckb: new Map(), fa: new Map() }
    for (const lang of ['ckb', 'fa'] as const)
      for (const [text, clip] of Object.entries(m[lang] ?? {})) {
        const key = text.replace(TRAILING_PUNCT, '')
        if (!loose[lang].has(key) || key === text) loose[lang].set(key, clip)
      }
  }
  for (const l of listeners) l()
}

/** Fetches public/audio/manifest.json once. Resolves null when there is none (or while offline). */
export function loadAudioManifest(): Promise<AudioManifest | null> {
  if (manifest) return Promise.resolve(manifest)
  if (loading) return loading
  if (failedAt && Date.now() - failedAt < RETRY_MS) return Promise.resolve(null)
  if (typeof fetch === 'undefined') return Promise.resolve(null)
  loading = fetch(`${AUDIO_BASE}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<AudioManifest>) : null))
    .catch(() => null)
    .then((m) => {
      loading = null
      if (m && m.ckb && m.fa) setManifest(m)
      else failedAt = Date.now()
      return manifest
    })
  return loading
}

/** For tests and tools: replace the loaded manifest. */
export function setAudioManifest(m: AudioManifest | null) {
  failedAt = 0
  loading = null
  setManifest(m)
}

/** The pre-generated clip for a text, if the manifest is loaded and has one. */
export function clipFor(lang: TargetLang, text: string): AudioClip | undefined {
  const table = manifest?.[lang]
  if (!table || !text) return undefined
  const key = canonicalize(text, lang)
  return table[key] ?? loose?.[lang].get(key.replace(TRAILING_PUNCT, ''))
}

export function clipUrl(clip: AudioClip): string {
  return `${AUDIO_BASE}${clip.f}`
}

export function voiceInfo(clip: AudioClip): AudioVoiceInfo | undefined {
  return manifest?.voices[clip.v]
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The audio manifest; re-renders once it has loaded. */
export function useAudioManifest(): AudioManifest | null {
  const m = useSyncExternalStore(subscribe, () => manifest, () => null)
  useEffect(() => {
    if (!manifest) void loadAudioManifest()
  }, [])
  return m
}

/** True when there is a pre-generated clip for `text`, or for any text of `lang` when `text` is omitted. */
export function useHasClip(lang: TargetLang, text?: string): boolean {
  const m = useAudioManifest()
  if (!m) return false
  if (text === undefined) return (loose?.[lang].size ?? 0) > 0
  return !!clipFor(lang, text)
}

const LANG_PREFIXES: Record<TargetLang, string[]> = {
  fa: ['fa', 'pes'],
  ckb: ['ckb', 'ku-iq', 'ku-arab', 'ku_iq'],
}

function voicesFor(lang: TargetLang): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return []
  const prefixes = LANG_PREFIXES[lang]
  return speechSynthesis
    .getVoices()
    .filter((v) => prefixes.some((p) => v.lang.toLowerCase().replace('_', '-').startsWith(p)))
}

/** The browser's speech-synthesis voice for a language. Re-renders when the voice list loads. */
export function useVoice(lang: TargetLang): SpeechSynthesisVoice | undefined {
  const [voice, setVoice] = useState(() => voicesFor(lang)[0])
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const update = () => setVoice(voicesFor(lang)[0])
    update()
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [lang])
  return voice
}

/** True when `speak` can produce sound for this language (and text, if given). */
export function useCanPlay(lang: TargetLang, text?: string, url?: string): boolean {
  const voice = useVoice(lang)
  const clip = useHasClip(lang, text)
  return !!url || clip || !!voice
}

let element: HTMLAudioElement | null = null
let token = 0

function player(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!element) {
    element = new Audio()
    element.preload = 'auto'
  }
  return element
}

export function stopAudio() {
  token++
  element?.pause()
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

const preloaded = new Map<string, HTMLAudioElement>()

/** Warms the HTTP cache for a clip that is likely to be played next. */
export function preloadAudio(lang: TargetLang, text: string, url?: string) {
  if (typeof Audio === 'undefined') return
  const run = () => {
    const clip = url ? undefined : clipFor(lang, text)
    const src = url ?? (clip && clipUrl(clip))
    if (!src || preloaded.has(src)) return
    const a = new Audio()
    a.preload = 'auto'
    a.src = src
    preloaded.set(src, a)
    if (preloaded.size > 12) preloaded.delete(preloaded.keys().next().value!)
  }
  if (manifest || url) run()
  else void loadAudioManifest().then(run)
}

type PlayResult = 'played' | 'failed' | 'blocked' | 'superseded'

async function playSource(src: string, rate: number, mine: number): Promise<PlayResult> {
  const el = player()
  if (!el) return 'failed'
  el.pause()
  el.src = src
  el.playbackRate = Math.min(2, Math.max(0.5, rate))
  el.preservesPitch = true
  try {
    await el.play()
    return mine === token ? 'played' : 'superseded'
  } catch (e) {
    if (mine !== token) return 'superseded'
    return (e as DOMException)?.name === 'NotAllowedError' ? 'blocked' : 'failed'
  }
}

export interface SpeakOptions {
  lang: TargetLang
  text: string
  /** A recording to prefer over generated audio. */
  url?: string
  voice?: SpeechSynthesisVoice
  /** 1 is natural speed; use `SLOW_RATE` for slow playback. */
  rate?: number
}

/** Plays a recording, a generated clip or browser speech, in that order. Resolves false if nothing could play. */
export async function speak({ lang, text, url, voice, rate = 1 }: SpeakOptions): Promise<boolean> {
  stopAudio()
  const mine = token
  if (url) {
    const r = await playSource(url, rate, mine)
    if (r === 'played') return true
    if (r !== 'failed') return false
  }
  if (!manifest) await loadAudioManifest()
  if (mine !== token) return false
  const clip = clipFor(lang, text)
  if (clip) {
    const r = await playSource(clipUrl(clip), rate, mine)
    if (r === 'played') return true
    if (r !== 'failed') return false
  }
  const v = voice ?? voicesFor(lang)[0]
  if (!v || typeof speechSynthesis === 'undefined') return false
  const u = new SpeechSynthesisUtterance(text)
  u.voice = v
  u.lang = v.lang
  u.rate = 0.85 * rate
  speechSynthesis.speak(u)
  return true
}
