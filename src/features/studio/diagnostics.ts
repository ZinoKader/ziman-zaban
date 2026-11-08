import type { MicError } from './mic'
import type { RecorderDiagnostics } from './use-take-recorder'
import { NOISY_FLOOR_DB } from './use-take-recorder'

export type Platform = 'ios' | 'android' | 'desktop'

export function platformOf(ua: string, touchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

const IN_APP: Array<[RegExp, string]> = [
  [/FBAN|FBAV|FB_IAB/, 'Facebook'],
  [/Instagram/, 'Instagram'],
  [/Messenger|FBMS/, 'Messenger'],
  [/Snapchat/, 'Snapchat'],
  [/TikTok|musical_ly|BytedanceWebview/, 'TikTok'],
  [/LinkedInApp/, 'LinkedIn'],
  [/\bLine\//, 'LINE'],
  [/WhatsApp/, 'WhatsApp'],
  [/Telegram/, 'Telegram'],
]

/** The app a page is opened inside of (its built-in browser often can't record), or null. */
export function inAppBrowser(ua: string): string | null {
  return IN_APP.find(([re]) => re.test(ua))?.[1] ?? null
}

export type LevelVerdict = 'good' | 'quiet' | 'loud' | 'noisy'

export const QUIET_PEAK_DB = -36
export const CLIPPING_DB = -0.3

/** How a test take sounds: `peakDb` is its sample peak, `floorDb` the background level between words. */
export function levelVerdict(peakDb: number, floorDb: number): LevelVerdict {
  if (peakDb > CLIPPING_DB) return 'loud'
  if (peakDb < QUIET_PEAK_DB) return 'quiet'
  if (floorDb > NOISY_FLOOR_DB) return 'noisy'
  return 'good'
}

export interface Environment {
  ua: string
  platform: Platform
  inApp: string | null
  secure: boolean
  getUserMedia: boolean
  audioContext: boolean
  audioWorklet: boolean
}

export function readEnvironment(): Environment {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  return {
    ua,
    platform: platformOf(ua, typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints),
    inApp: inAppBrowser(ua),
    secure: typeof window === 'undefined' || window.isSecureContext !== false,
    getUserMedia: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    audioContext: typeof window !== 'undefined' && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext),
    audioWorklet: typeof AudioWorkletNode !== 'undefined',
  }
}

const yesNo = (v: boolean) => (v ? 'yes' : 'no')
const db = (v: number) => `${Math.round(v)} dB`

/** Plain text for the "Copy details" button, so a speaker can send it to whoever helps them. */
export function diagnosticsReport(
  env: Environment,
  diag: RecorderDiagnostics,
  result: { error: MicError | null; peakDb?: number; verdict?: LevelVerdict },
  now = new Date(),
): string {
  const lines = [
    `Ziman·Zabân microphone check, ${now.toISOString()}`,
    `Browser: ${env.ua}`,
    `Platform: ${env.platform}${env.inApp ? `, inside ${env.inApp}` : ''}`,
    `Secure page: ${yesNo(env.secure)}. Microphone API: ${yesNo(env.getUserMedia)}. Web Audio: ${yesNo(env.audioContext)}. AudioWorklet: ${yesNo(env.audioWorklet)}`,
  ]
  if (diag.info) {
    lines.push(`Recording with: ${diag.info.engine}, ${diag.info.sampleRate} Hz`)
    lines.push(`Microphone: ${diag.info.device || 'no name'}`)
    lines.push(`Track settings: ${JSON.stringify(diag.info.settings)}`)
  }
  if (diag.state) lines.push(`Audio state: ${diag.state}`)
  lines.push(`Sound chunks received: ${diag.chunks}`)
  if (diag.chunks) lines.push(`Level now: ${db(diag.levelDb)}, background: ${db(diag.floorDb)}`)
  if (result.peakDb !== undefined) lines.push(`Test word: peak ${db(result.peakDb)}, ${result.verdict}`)
  lines.push(`Error: ${result.error ? `${result.error}${diag.errorDetail ? ` (${diag.errorDetail})` : ''}` : 'none'}`)
  return lines.join('\n')
}
