import { gapFor, minVoicedFor, Segmenter, Tape } from './segmenter'

const SR = 16_000

/** Builds a signal from [kind, ms] parts: quiet noise for 'sil', a loud tone for 'say'. */
function signal(parts: Array<['sil' | 'say', number]>): Float32Array {
  const total = parts.reduce((n, [, ms]) => n + (ms * SR) / 1000, 0)
  const out = new Float32Array(total)
  let i = 0
  let seed = 1
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.002
  for (const [kind, ms] of parts) {
    const n = (ms * SR) / 1000
    for (let k = 0; k < n; k++, i++) out[i] = kind === 'say' ? 0.3 * Math.sin((2 * Math.PI * 220 * i) / SR) : noise()
  }
  return out
}

function run(seg: Segmenter, s: Float32Array, chunk = 333) {
  const found = []
  for (let i = 0; i < s.length; i += chunk) found.push(...seg.push(s.subarray(i, i + chunk)))
  return found
}

const ms = (samples: number) => (samples * 1000) / SR

describe('Segmenter', () => {
  it('cuts one take per word at the pauses between them, with some padding', () => {
    const seg = new Segmenter({ sampleRate: SR, gapMs: 500 })
    const found = run(seg, signal([['sil', 600], ['say', 400], ['sil', 700], ['say', 300], ['sil', 800]]))
    expect(found).toHaveLength(2)
    expect(ms(found[0].start)).toBeCloseTo(600 - 250, -1)
    expect(ms(found[0].end)).toBeCloseTo(1000 + 300, -1)
    expect(found[0].voicedMs).toBeGreaterThanOrEqual(390)
    expect(ms(found[1].start)).toBeGreaterThanOrEqual(ms(found[0].end))
  })

  it('does not end a take at a short pause inside it', () => {
    const seg = new Segmenter({ sampleRate: SR, gapMs: 500 })
    const found = run(seg, signal([['sil', 500], ['say', 400], ['sil', 300], ['say', 400], ['sil', 700]]))
    expect(found).toHaveLength(1)
    expect(found[0].voicedMs).toBeGreaterThanOrEqual(790)
  })

  it('waits for a longer pause until a sentence has enough speech', () => {
    const seg = new Segmenter({ sampleRate: SR, gapMs: 500, minVoicedMs: 1000, longGapMs: 1500 })
    const found = run(seg, signal([['sil', 500], ['say', 500], ['sil', 900], ['say', 600], ['sil', 700]]))
    expect(found).toHaveLength(1)
    expect(ms(found[0].end - found[0].start)).toBeGreaterThan(2000)
  })

  it('drops clicks and short noises', () => {
    const seg = new Segmenter({ sampleRate: SR })
    expect(run(seg, signal([['sil', 500], ['say', 60], ['sil', 1000]]))).toEqual([])
  })

  it('forgets a take in progress when cancelled', () => {
    const seg = new Segmenter({ sampleRate: SR })
    run(seg, signal([['sil', 500], ['say', 300]]))
    expect(seg.speechActive).toBe(true)
    seg.cancel()
    expect(run(seg, signal([['sil', 1000]]))).toEqual([])
  })
})

describe('Tape', () => {
  it('cuts out samples by absolute position and forgets old audio', () => {
    const tape = new Tape(10)
    for (let c = 0; c < 5; c++) tape.push(Float32Array.from({ length: 4 }, (_, i) => c * 4 + i))
    expect([...tape.slice(12, 16)]).toEqual([12, 13, 14, 15])
    expect([...tape.slice(6, 10)]).toEqual([8, 9])
    expect([...tape.slice(0, 4)]).toEqual([])
  })
})

describe('take timing per prompt', () => {
  it('lets sentences pause longer than words', () => {
    expect(gapFor('ئاو')).toBeLessThan(gapFor('ناوت چییە؟'))
    expect(minVoicedFor('ئاو')).toBeLessThan(minVoicedFor('من خەڵکی هەولێرم'))
    expect(minVoicedFor('x'.repeat(200))).toBe(1500)
  })
})
