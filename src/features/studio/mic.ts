/** Raw microphone samples through an AudioWorklet. Browser processing is off so takes sound like the speaker. */

const TAP = `
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0 }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i]
      if (this.n === this.buf.length) { this.port.postMessage(this.buf, [this.buf.buffer]); this.buf = new Float32Array(2048); this.n = 0 }
    }
    return true
  }
}
registerProcessor('zz-tap', Tap)
`

export interface Mic {
  sampleRate: number
  stop: () => void
}

export type MicError = 'unsupported' | 'denied' | 'failed'

export function micSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof AudioWorkletNode !== 'undefined'
}

export async function openMic(onChunk: (samples: Float32Array) => void): Promise<Mic> {
  if (!micSupported()) throw Object.assign(new Error('unsupported'), { code: 'unsupported' satisfies MicError })
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
  } catch (e) {
    const denied = (e as DOMException)?.name === 'NotAllowedError'
    throw Object.assign(new Error('mic'), { code: (denied ? 'denied' : 'failed') satisfies MicError })
  }
  const ctx = new AudioContext()
  const url = URL.createObjectURL(new Blob([TAP], { type: 'application/javascript' }))
  try {
    await ctx.audioWorklet.addModule(url)
  } finally {
    URL.revokeObjectURL(url)
  }
  const source = ctx.createMediaStreamSource(stream)
  const tap = new AudioWorkletNode(ctx, 'zz-tap', { channelCount: 1, channelCountMode: 'explicit' })
  tap.port.onmessage = (e: MessageEvent<Float32Array>) => onChunk(e.data)
  // The worklet only runs while connected to the output; a muted gain keeps the speaker from hearing themselves.
  const mute = ctx.createGain()
  mute.gain.value = 0
  source.connect(tap).connect(mute).connect(ctx.destination)
  if (ctx.state === 'suspended') await ctx.resume()
  return {
    sampleRate: ctx.sampleRate,
    stop: () => {
      tap.port.onmessage = null
      stream.getTracks().forEach((t) => t.stop())
      if (ctx.state !== 'closed') void ctx.close().catch(() => {})
    },
  }
}
