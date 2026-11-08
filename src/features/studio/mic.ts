/**
 * Raw microphone samples through an AudioWorklet, or a ScriptProcessor where the worklet won't load.
 * Browser processing is off so takes sound like the speaker.
 */

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

export type MicError = 'unsupported' | 'insecure' | 'denied' | 'busy' | 'nodevice' | 'blocked' | 'silent' | 'failed'

export interface MicInfo {
  engine: 'worklet' | 'script'
  sampleRate: number
  device: string
  settings: MediaTrackSettings
}

export interface Mic {
  sampleRate: number
  info: MicInfo
  /** The audio context's state: "running", or "suspended" / "interrupted" when the browser stopped it. */
  state: () => string
  stop: () => void
}

export interface MicFailure extends Error {
  code: MicError
}

type AudioContextClass = typeof AudioContext

function audioContextClass(): AudioContextClass | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext
}

export function micSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!audioContextClass()
}

export function micFailure(code: MicError, detail?: string): MicFailure {
  return Object.assign(new Error(detail ?? code), { code })
}

export function failureCode(e: unknown): MicError {
  return (e as Partial<MicFailure>)?.code ?? 'failed'
}

let shared: AudioContext | null = null
const tapLoaded = new WeakSet<AudioContext>()

function context(): AudioContext {
  if (!shared || shared.state === 'closed') shared = new (audioContextClass()!)()
  return shared
}

/**
 * iOS only starts audio inside a tap or click. Call this at the top of the handler that leads to `openMic`,
 * before anything is awaited.
 */
export function unlockAudio() {
  if (!micSupported()) return
  const ctx = context()
  if (ctx.state !== 'running') void ctx.resume().catch(() => {})
}

const RESUME_TIMEOUT_MS = 1500

async function running(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === 'running') return true
  await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, RESUME_TIMEOUT_MS))])
  return (ctx.state as string) === 'running'
}

async function loadTap(ctx: AudioContext): Promise<boolean> {
  if (tapLoaded.has(ctx)) return true
  if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') return false
  const blob = URL.createObjectURL(new Blob([TAP], { type: 'application/javascript' }))
  for (const url of [blob, `data:application/javascript;charset=utf-8,${encodeURIComponent(TAP)}`]) {
    try {
      await ctx.audioWorklet.addModule(url)
      tapLoaded.add(ctx)
      break
    } catch {
      // Some browsers refuse one kind of URL; try the next, then fall back to a ScriptProcessor.
    }
  }
  URL.revokeObjectURL(blob)
  return tapLoaded.has(ctx)
}

function deviceError(e: unknown): MicFailure {
  const name = (e as DOMException)?.name ?? ''
  const detail = `${name}: ${(e as Error)?.message ?? e}`
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return micFailure('denied', detail)
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return micFailure('busy', detail)
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return micFailure('nodevice', detail)
  return micFailure('failed', detail)
}

export async function openMic(onChunk: (samples: Float32Array) => void): Promise<Mic> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) throw micFailure('insecure')
  if (!micSupported()) throw micFailure('unsupported')
  const ctx = context()
  if (ctx.state !== 'running') void ctx.resume().catch(() => {})

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
  } catch (e) {
    throw deviceError(e)
  }
  const release = () => stream.getTracks().forEach((t) => t.stop())

  try {
    if (!(await running(ctx))) throw micFailure('blocked', `AudioContext ${ctx.state}`)
    const source = ctx.createMediaStreamSource(stream)
    // The tap only runs while connected to the output; a muted gain keeps the speaker from hearing themselves.
    const mute = ctx.createGain()
    mute.gain.value = 0
    let node: AudioNode
    let detach: () => void
    let engine: MicInfo['engine']
    if (await loadTap(ctx)) {
      const tap = new AudioWorkletNode(ctx, 'zz-tap', { channelCount: 1, channelCountMode: 'explicit' })
      tap.port.onmessage = (e: MessageEvent<Float32Array>) => onChunk(e.data)
      node = tap
      detach = () => (tap.port.onmessage = null)
      engine = 'worklet'
    } else {
      const sp = ctx.createScriptProcessor(2048, 1, 1)
      sp.onaudioprocess = (e) => onChunk(new Float32Array(e.inputBuffer.getChannelData(0)))
      node = sp
      detach = () => (sp.onaudioprocess = null)
      engine = 'script'
    }
    source.connect(node).connect(mute).connect(ctx.destination)
    const track = stream.getAudioTracks()[0]
    return {
      sampleRate: ctx.sampleRate,
      info: { engine, sampleRate: ctx.sampleRate, device: track?.label ?? '', settings: track?.getSettings?.() ?? {} },
      state: () => ctx.state,
      stop: () => {
        detach()
        source.disconnect()
        node.disconnect()
        mute.disconnect()
        release()
      },
    }
  } catch (e) {
    release()
    throw (e as Partial<MicFailure>)?.code ? e : micFailure('failed', String(e))
  }
}
