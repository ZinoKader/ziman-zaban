import { strToU8, zipSync, type Zippable } from 'fflate'
import type { TextKind } from '@/content/audio-texts'
import type { TargetLang } from '@/content/types'
import type { TakeMeta } from './store'

export const RECORDING_FORMAT = 'ziman-zaban-recordings'
export const RECORDING_LICENSE = 'CC BY-SA 4.0'

/** `takes.json` inside an exported zip. `scripts/audio/import-recordings.py` reads it. */
export interface RecordingIndex {
  format: typeof RECORDING_FORMAT
  version: 1
  lang: TargetLang
  speaker: string
  license: string
  consentAt: string
  exportedAt: string
  takes: Array<{ file: string; text: string; latin: string; kind: TextKind; recordedAt: string; durationMs: number }>
}

export function buildRecordingZip(
  info: { lang: TargetLang; speaker: string; consentAt: string },
  takes: Array<{ meta: TakeMeta; wav: Uint8Array }>,
  now = new Date(),
): Uint8Array {
  const files: Zippable = {}
  const index: RecordingIndex = {
    format: RECORDING_FORMAT,
    version: 1,
    lang: info.lang,
    speaker: info.speaker,
    license: RECORDING_LICENSE,
    consentAt: info.consentAt,
    exportedAt: now.toISOString(),
    takes: takes.map(({ meta, wav }, i) => {
      const file = `audio/${String(i + 1).padStart(4, '0')}.wav`
      // WAV is PCM: deflating it saves little and costs time on phones.
      files[file] = [wav, { level: 0 }]
      return { file, text: meta.text, latin: meta.latin, kind: meta.kind, recordedAt: meta.recordedAt, durationMs: meta.durationMs }
    }),
  }
  files['takes.json'] = strToU8(JSON.stringify(index, null, 1) + '\n')
  return zipSync(files)
}

export function zipName(lang: TargetLang, speaker: string, now = new Date()): string {
  const who = speaker.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'speaker'
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '')
  return `ziman-zaban-recordings-${lang}-${who}-${stamp}.zip`
}

export function download(name: string, bytes: Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
