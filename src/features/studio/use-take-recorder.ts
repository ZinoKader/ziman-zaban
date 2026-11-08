import { useCallback, useEffect, useRef, useState } from 'react'
import { openMic, type Mic, type MicError } from './mic'
import { gapFor, minVoicedFor, Segmenter, Tape } from './segmenter'

export type RecorderStatus = 'idle' | 'starting' | 'listening' | 'hearing' | 'paused' | 'error'

export interface Take {
  samples: Float32Array
  sampleRate: number
  voicedMs: number
}

const NOISY_FLOOR_DB = -42

/**
 * Keeps the microphone open and calls `onTake` each time the speaker finishes a take and pauses.
 * `prompt` is the text being read; it sets how long a pause ends a take.
 */
export function useTakeRecorder(prompt: string | undefined, onTake: (take: Take) => void) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [error, setError] = useState<MicError | null>(null)
  const [level, setLevel] = useState(0)
  const [noisy, setNoisy] = useState(false)
  const mic = useRef<Mic | null>(null)
  const seg = useRef<Segmenter | null>(null)
  const tape = useRef<Tape | null>(null)
  const paused = useRef(false)
  const onTakeRef = useRef(onTake)
  const promptRef = useRef(prompt)

  useEffect(() => {
    onTakeRef.current = onTake
  }, [onTake])

  useEffect(() => {
    promptRef.current = prompt
    if (prompt) seg.current?.setOptions({ gapMs: gapFor(prompt), minVoicedMs: minVoicedFor(prompt) })
  }, [prompt])

  const handle = useCallback((chunk: Float32Array) => {
    const s = seg.current
    const t = tape.current
    if (!s || !t) return
    t.push(chunk)
    const done = s.push(chunk)
    if (paused.current) {
      if (s.speechActive) s.cancel()
      return
    }
    for (const d of done) onTakeRef.current({ samples: t.slice(d.start, d.end), sampleRate: mic.current!.sampleRate, voicedMs: d.voicedMs })
  }, [])

  const starting = useRef(false)
  /** False once `stop` was called, so a microphone that finishes opening afterwards is closed again. */
  const wanted = useRef(false)
  const start = useCallback(async () => {
    wanted.current = true
    if (mic.current || starting.current) return
    starting.current = true
    setStatus('starting')
    setError(null)
    try {
      const m = await openMic(handle)
      if (!wanted.current) return m.stop()
      mic.current = m
      seg.current = new Segmenter({ sampleRate: m.sampleRate })
      const p = promptRef.current
      if (p) seg.current.setOptions({ gapMs: gapFor(p), minVoicedMs: minVoicedFor(p) })
      tape.current = new Tape(m.sampleRate * 30)
      paused.current = false
      setStatus('listening')
    } catch (e) {
      setError(((e as { code?: MicError }).code ?? 'failed') as MicError)
      setStatus('error')
    } finally {
      starting.current = false
    }
  }, [handle])

  const stop = useCallback(() => {
    wanted.current = false
    mic.current?.stop()
    mic.current = null
    seg.current = null
    tape.current = null
    setStatus('idle')
    setLevel(0)
  }, [])

  const setPaused = useCallback((p: boolean) => {
    paused.current = p
    seg.current?.cancel()
    setStatus(p ? 'paused' : 'listening')
  }, [])

  /** Drops a take in progress, e.g. after going back. */
  const cancel = useCallback(() => seg.current?.cancel(), [])

  useEffect(() => {
    if (status !== 'listening' && status !== 'hearing') return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 60) return
      last = t
      const s = seg.current
      if (!s) return
      setLevel(Math.max(0, Math.min(1, (s.levelDb + 60) / 50)))
      setNoisy(s.floorDb > NOISY_FLOOR_DB)
      setStatus(s.speechActive ? 'hearing' : 'listening')
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status])

  useEffect(() => () => mic.current?.stop(), [])

  return { status, error, level, noisy, start, stop, setPaused, cancel }
}
