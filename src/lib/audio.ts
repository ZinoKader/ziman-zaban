import { useEffect, useState } from 'react'
import type { TargetLang } from '@/content/types'

/*
 * Pronunciation comes from, in order of preference:
 *  1. recorded audio attached to the content (native speakers, Wikimedia Commons)
 *  2. a speech-synthesis voice installed in the browser/OS for that language
 * Persian voices (fa-IR) are common. Sorani (ckb) voices are rare, so most Sorani
 * audio has to come from recordings.
 */

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

/** Re-renders when the browser finishes loading its voice list. */
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

let current: HTMLAudioElement | null = null

export function stopAudio() {
  current?.pause()
  current = null
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

export interface SpeakOptions {
  lang: TargetLang
  text: string
  url?: string
  voice?: SpeechSynthesisVoice
  rate?: number
}

/** Plays a recording if there is one, otherwise synthesizes. Resolves false if nothing could play. */
export async function speak({ lang, text, url, voice, rate = 0.85 }: SpeakOptions): Promise<boolean> {
  stopAudio()
  if (url) {
    try {
      const audio = new Audio(url)
      current = audio
      audio.playbackRate = rate < 0.8 ? 0.8 : 1
      await audio.play()
      return true
    } catch {
      // fall through to synthesis
    }
  }
  const v = voice ?? voicesFor(lang)[0]
  if (!v || typeof speechSynthesis === 'undefined') return false
  const u = new SpeechSynthesisUtterance(text)
  u.voice = v
  u.lang = v.lang
  u.rate = rate
  speechSynthesis.speak(u)
  return true
}
