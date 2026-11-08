import { strFromU8, unzipSync } from 'fflate'
import { buildRecordingZip, zipName, type RecordingIndex } from './export'
import { promptsFor, promptTotal } from './prompts'
import { back, countRecorded, recorded, skipped, startRun } from './run'
import type { TakeMeta } from './store'
import { encodeWav, peakDb } from './wav'

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header and clamps samples', () => {
    const wav = encodeWav(Float32Array.from([0, 0.5, -1, 2]), 48_000)
    const view = new DataView(wav.buffer)
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...wav.subarray(8, 12))).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(48_000)
    expect(view.getUint32(40, true)).toBe(8)
    expect([1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([16383, -32768, 32767])
  })

  it('measures the peak level', () => {
    expect(peakDb(Float32Array.from([0.1, -0.5]))).toBeCloseTo(-6.02, 1)
  })
})

describe('promptsFor', () => {
  it('lists words before sentences, each once, with what they mean', () => {
    const words = promptsFor('ckb', 'words')
    expect(words.length).toBe(promptTotal('ckb', 'words'))
    expect(words.every((p) => p.kind === 'word')).toBe(true)
    expect(new Set(words.map((p) => p.text)).size).toBe(words.length)
    expect(words[0].meaning?.en).toBeTruthy()

    const all = promptsFor('fa', 'all')
    const firstSentence = all.findIndex((p) => p.kind !== 'word')
    expect(all.slice(firstSentence).some((p) => p.kind === 'word')).toBe(false)
  })

  it('leaves out texts that already have a recording', () => {
    const words = promptsFor('ckb', 'words')
    const done = new Set(words.slice(0, 5).map((p) => p.text))
    expect(promptsFor('ckb', 'words', (t) => done.has(t))).toEqual(words.slice(5))
  })
})

describe('a recording run', () => {
  it('moves on after each take or skip, and goes back one step at a time', () => {
    const s = recorded(skipped(recorded(startRun())))
    expect(s.index).toBe(3)
    expect(countRecorded(s)).toBe(2)
    let step = back(s)
    expect(step.undo).toBe(2)
    step = back(step.state)
    expect(step).toEqual({ state: { index: 1, history: [{ index: 0, recorded: true }] }, undo: null })
    step = back(step.state)
    expect(step).toEqual({ state: startRun(), undo: 0 })
    expect(back(startRun())).toEqual({ state: startRun(), undo: null })
  })
})

describe('buildRecordingZip', () => {
  it('packs every take as a WAV file with an index the import script reads', () => {
    const meta: TakeMeta = { lang: 'ckb', text: 'ئاو', latin: 'aw', kind: 'word', recordedAt: '2026-11-08T10:00:00.000Z', durationMs: 900, peakDb: -6 }
    const wav = encodeWav(new Float32Array(10), 48_000)
    const zip = buildRecordingZip({ lang: 'ckb', speaker: 'Aras', consentAt: '2026-11-08T09:00:00.000Z' }, [{ meta, wav }], new Date('2026-11-08T11:00:00Z'))
    const files = unzipSync(zip)
    const index = JSON.parse(strFromU8(files['takes.json'])) as RecordingIndex
    expect(index).toMatchObject({ format: 'ziman-zaban-recordings', version: 1, lang: 'ckb', speaker: 'Aras', license: 'CC BY-SA 4.0' })
    expect(index.takes).toEqual([{ file: 'audio/0001.wav', text: 'ئاو', latin: 'aw', kind: 'word', recordedAt: meta.recordedAt, durationMs: 900 }])
    expect(files['audio/0001.wav']).toEqual(wav)
  })

  it('names the file after language, speaker and time', () => {
    expect(zipName('fa', 'Širin Ahmadi', new Date('2026-11-08T10:05:00Z'))).toBe('ziman-zaban-recordings-fa-sirin-ahmadi-202611081005.zip')
  })
})
