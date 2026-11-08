import { useCallback, useEffect, useRef, useState } from 'react'
import { failureCode, micFailure, openMic, type Mic, type MicError, type MicInfo } from './mic'
import { gapFor, minVoicedFor, Segmenter, Tape } from './segmenter'

export type RecorderStatus = 'idle' | 'starting' | 'listening' | 'hearing' | 'paused' | 'error'

export interface Take {
  samples: Float32Array
  sampleRate: number
  voicedMs: number
  /** Background level in dBFS when the take ended. */
  floorDb: number
}

/** What the mic check shows, refreshed a few times a second while the microphone is open. */
export interface RecorderDiagnostics {
  info: MicInfo | null
  chunks: number
  floorDb: number
  levelDb: number
  state: string
  errorDetail: string
}

export const NOISY_FLOOR_DB = -42
/** With the microphone open, this long without any samples means the browser stopped the sound. */
const SILENT_MS = 2500

/**
 * Keeps the microphone open and calls `onTake` each time the speaker finishes a take and pauses.
 * `prompt` is the text being read; it sets how long a pause ends a take.
 */
export function useTakeRecorder(prompt: string | undefined, onTake: (take: Take) => void) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [error, setError] = useState<MicError | null>(null)
  const [level, setLevel] = useState(0)
  const [noisy, setNoisy] = useState(false)
  const [diag, setDiag] = useState<RecorderDiagnostics>({ info: null, chunks: 0, floorDb: -100, levelDb: -100, state: '', errorDetail: '' })
  const mic = useRef<Mic | null>(null)
  const seg = useRef<Segmenter | null>(null)
  const tape = useRef<Tape | null>(null)
  const paused = useRef(false)
  const chunks = useRef(0)
  const lastChunkAt = useRef(0)
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
    chunks.current++
    lastChunkAt.current = performance.now()
    const s = seg.current
    const t = tape.current
    if (!s || !t) return
    t.push(chunk)
    const done = s.push(chunk)
    if (paused.current) {
      if (s.speechActive) s.cancel()
      return
    }
    for (const d of done)
      onTakeRef.current({ samples: t.slice(d.start, d.end), sampleRate: mic.current!.sampleRate, voicedMs: d.voicedMs, floorDb: s.floorDb })
  }, [])

  const close = useCallback(() => {
    mic.current?.stop()
    mic.current = null
    seg.current = null
    tape.current = null
    setLevel(0)
  }, [])

  const fail = useCallback(
    (e: unknown) => {
      close()
      setError(failureCode(e))
      setDiag((d) => ({ ...d, errorDetail: (e as Error)?.message ?? String(e) }))
      setStatus('error')
    },
    [close],
  )

  const starting = useRef(false)
  /** False once `stop` was called, so a microphone that finishes opening afterwards is closed again. */
  const wanted = useRef(false)
  const start = useCallback(async () => {
    wanted.current = true
    if (mic.current || starting.current) return
    starting.current = true
    setStatus('starting')
    setError(null)
    chunks.current = 0
    setDiag({ info: null, chunks: 0, floorDb: -100, levelDb: -100, state: '', errorDetail: '' })
    try {
      const m = await openMic(handle)
      if (!wanted.current) return m.stop()
      mic.current = m
      seg.current = new Segmenter({ sampleRate: m.sampleRate })
      const p = promptRef.current
      if (p) seg.current.setOptions({ gapMs: gapFor(p), minVoicedMs: minVoicedFor(p) })
      tape.current = new Tape(m.sampleRate * 30)
      paused.current = false
      lastChunkAt.current = performance.now()
      setDiag((d) => ({ ...d, info: m.info, state: m.state() }))
      setStatus('listening')
    } catch (e) {
      fail(e)
    } finally {
      starting.current = false
    }
  }, [handle, fail])

  const stop = useCallback(() => {
    wanted.current = false
    close()
    setStatus('idle')
  }, [close])

  const setPaused = useCallback((p: boolean) => {
    paused.current = p
    seg.current?.cancel()
    setStatus(p ? 'paused' : 'listening')
  }, [])

  /** Drops a take in progress, e.g. after going back. */
  const cancel = useCallback(() => seg.current?.cancel(), [])

  const open = status === 'listening' || status === 'hearing' || status === 'paused'
  useEffect(() => {
    if (!open) return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 60) return
      last = t
      const s = seg.current
      const m = mic.current
      if (!s || !m) return
      if (performance.now() - lastChunkAt.current > SILENT_MS) {
        const state = m.state()
        return fail(micFailure(state === 'running' ? 'silent' : 'blocked', `no samples for ${SILENT_MS} ms, AudioContext ${state}`))
      }
      // Relative to the background, so the meter moves as much for a quiet phone microphone as for a loud one.
      setLevel(Math.max(0, Math.min(1, (s.levelDb - s.floorDb - 6) / 36)))
      setNoisy(s.floorDb > NOISY_FLOOR_DB)
      setDiag((d) => ({ ...d, chunks: chunks.current, floorDb: s.floorDb, levelDb: s.levelDb, state: m.state() }))
      if (!paused.current) setStatus(s.speechActive ? 'hearing' : 'listening')
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, fail])

  useEffect(() => () => mic.current?.stop(), [])

  return { status, error, level, noisy, diag, start, stop, setPaused, cancel }
}
