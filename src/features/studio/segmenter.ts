/**
 * Splits a live microphone stream into takes at pauses, so a speaker can read one prompt after another
 * without pressing anything in between. Works on 10 ms frames with an adaptive noise floor.
 */

export interface SegmenterOptions {
  sampleRate: number
  /** A pause this long ends a take, once the take has `minVoicedMs` of speech. */
  gapMs: number
  /** Speech a take needs before a normal pause can end it. A shorter take waits for `longGapMs`, so a sentence read with a breath in the middle stays one take. */
  minVoicedMs: number
  longGapMs: number
  /** Audio kept before the first and after the last voiced frame. */
  prerollMs: number
  postrollMs: number
  /** A take is cut here even if the speaker keeps talking. */
  maxMs: number
  /** Bursts with less speech than this (a click, a cough, a breath) are dropped. */
  minTakeVoicedMs: number
}

export const DEFAULT_SEGMENTER: Omit<SegmenterOptions, 'sampleRate'> = {
  gapMs: 600,
  minVoicedMs: 0,
  longGapMs: 2000,
  prerollMs: 250,
  postrollMs: 300,
  maxMs: 20_000,
  minTakeVoicedMs: 120,
}

/** Sample positions are counted from the first sample pushed. `end` is exclusive. */
export interface Segment {
  start: number
  end: number
  voicedMs: number
}

const FRAME_MS = 10
const ON_ABOVE_FLOOR = 14
const OFF_ABOVE_FLOOR = 8
const ON_MIN_DB = -52
const OFF_MIN_DB = -58
const FRAMES_TO_START = 3
const CALIBRATION_FRAMES = 30

export function frameDb(samples: Float32Array, from = 0, to = samples.length): number {
  let sum = 0
  for (let i = from; i < to; i++) sum += samples[i] * samples[i]
  return 10 * Math.log10(sum / Math.max(1, to - from) + 1e-12)
}

export class Segmenter {
  private opts: SegmenterOptions
  private readonly frameLen: number
  private readonly frame: Float32Array
  private filled = 0
  private pos = 0
  private frames = 0
  private above = 0
  private speaking = false
  private segStart = 0
  private voicedMs = 0
  private silentMs = 0
  private lastVoicedEnd = 0
  private lastEnd = 0
  /** Noise floor in dBFS. */
  floorDb = -60
  /** Level of the last frame in dBFS, for a meter. */
  levelDb = -100

  constructor(options: Partial<SegmenterOptions> & { sampleRate: number }) {
    this.opts = { ...DEFAULT_SEGMENTER, ...options }
    this.frameLen = Math.round((this.opts.sampleRate * FRAME_MS) / 1000)
    this.frame = new Float32Array(this.frameLen)
  }

  get speechActive(): boolean {
    return this.speaking
  }

  /** Samples pushed so far. */
  get position(): number {
    return this.pos
  }

  /** Changes how the current and later takes end, e.g. when the prompt changes from a word to a sentence. */
  setOptions(patch: Partial<Omit<SegmenterOptions, 'sampleRate'>>) {
    this.opts = { ...this.opts, ...patch }
  }

  /** Drops a take in progress, e.g. when the speaker pauses or goes back. */
  cancel() {
    this.speaking = false
    this.above = 0
    this.lastEnd = this.pos
  }

  /** Feeds audio and returns the takes that ended within it. */
  push(samples: Float32Array): Segment[] {
    const done: Segment[] = []
    let i = 0
    while (i < samples.length) {
      const n = Math.min(this.frameLen - this.filled, samples.length - i)
      this.frame.set(samples.subarray(i, i + n), this.filled)
      this.filled += n
      i += n
      if (this.filled === this.frameLen) {
        this.filled = 0
        this.pos += this.frameLen
        const s = this.step(frameDb(this.frame))
        if (s) done.push(s)
      }
    }
    return done
  }

  private ms(samples: number) {
    return (samples * 1000) / this.opts.sampleRate
  }

  private samples(ms: number) {
    return Math.round((ms * this.opts.sampleRate) / 1000)
  }

  private step(db: number): Segment | null {
    this.levelDb = db
    this.frames++
    if (this.frames <= CALIBRATION_FRAMES) {
      this.floorDb = this.frames === 1 ? db : this.floorDb + (db - this.floorDb) / this.frames
      return null
    }
    const on = Math.max(this.floorDb + ON_ABOVE_FLOOR, ON_MIN_DB)
    const off = Math.max(this.floorDb + OFF_ABOVE_FLOOR, OFF_MIN_DB)
    const frameEnd = this.pos
    const frameStart = frameEnd - this.frameLen

    if (!this.speaking) {
      // Follow the floor down quickly and up slowly, so speech does not raise it.
      this.floorDb += db < this.floorDb ? (db - this.floorDb) * 0.3 : Math.min(db - this.floorDb, 6) * 0.01
      this.above = db > on ? this.above + 1 : 0
      if (this.above >= FRAMES_TO_START) {
        this.speaking = true
        const firstVoiced = frameStart - (this.above - 1) * this.frameLen
        this.segStart = Math.max(firstVoiced - this.samples(this.opts.prerollMs), this.lastEnd, 0)
        this.voicedMs = this.above * FRAME_MS
        this.silentMs = 0
        this.lastVoicedEnd = frameEnd
        this.above = 0
      }
      return null
    }

    if (db > off) {
      this.voicedMs += FRAME_MS
      this.silentMs = 0
      this.lastVoicedEnd = frameEnd
    } else {
      this.silentMs += FRAME_MS
    }
    const gap = this.voicedMs >= this.opts.minVoicedMs ? this.opts.gapMs : this.opts.longGapMs
    const tooLong = this.ms(frameEnd - this.segStart) >= this.opts.maxMs
    if (this.silentMs < gap && !tooLong) return null

    this.speaking = false
    const end = Math.min(this.lastVoicedEnd + this.samples(this.opts.postrollMs), frameEnd)
    this.lastEnd = end
    if (this.voicedMs < this.opts.minTakeVoicedMs) return null
    return { start: this.segStart, end, voicedMs: this.voicedMs }
  }
}

/** Keeps the most recent audio so a take can be cut out once the segmenter has found its end. */
export class Tape {
  private chunks: Float32Array[] = []
  private first = 0
  private total = 0
  private readonly keepSamples: number

  constructor(keepSamples: number) {
    this.keepSamples = keepSamples
  }

  push(samples: Float32Array) {
    this.chunks.push(samples)
    this.total += samples.length
    while (this.chunks.length > 1 && this.total - this.first - this.chunks[0].length >= this.keepSamples) {
      this.first += this.chunks[0].length
      this.chunks.shift()
    }
  }

  /** Copies samples `[start, end)`; parts no longer kept are left out. */
  slice(start: number, end: number): Float32Array {
    const from = Math.max(start, this.first)
    const to = Math.min(end, this.total)
    const out = new Float32Array(Math.max(0, to - from))
    let offset = this.first
    for (const c of this.chunks) {
      const a = Math.max(from, offset)
      const b = Math.min(to, offset + c.length)
      if (b > a) out.set(c.subarray(a - offset, b - offset), a - from)
      offset += c.length
      if (offset >= to) break
    }
    return out
  }
}

/** Speech a take of this text should have at the least, so a pause in the middle does not split it. */
export function minVoicedFor(text: string): number {
  const letters = text.replace(/[\s\u200c.,!?;:،؛؟…"«»-]/gu, '').length
  return Math.min(1500, letters * 28)
}

/** How long a pause ends a take: short for single words, longer for sentences. */
export function gapFor(text: string): number {
  return /\s/.test(text.trim()) ? 800 : 550
}
