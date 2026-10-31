import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'done' | 'denied'

export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

/** Records the learner's spoken answer so they can play it back next to the model answer. */
export function useRecorder(onStop?: () => void) {
  const [state, setState] = useState<RecorderState>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const urlRef = useRef<string | null>(null)
  const stopped = useRef(onStop)
  useEffect(() => {
    stopped.current = onStop
  })

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }, [])

  useEffect(
    () => () => {
      const rec = recorder.current
      if (rec?.state === 'recording') {
        rec.onstop = null
        rec.ondataavailable = null
        rec.stop()
      }
      release()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [release],
  )

  const start = useCallback(async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      const rec = new MediaRecorder(media)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      rec.onstop = () => {
        release()
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        const next = chunks.length ? URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })) : null
        urlRef.current = next
        setUrl(next)
        setState('done')
        stopped.current?.()
      }
      recorder.current = rec
      rec.start()
      setState('recording')
    } catch {
      release()
      setState('denied')
    }
  }, [release])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  return { state, url, start, stop }
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function recognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/**
 * Optional speech-to-text for Persian (browsers offer fa-IR; there is no Sorani model).
 * The transcript goes through the same matcher as a typed answer.
 */
export function useDictation(enabled: boolean, onTranscript: (text: string) => void) {
  const Ctor = enabled ? recognitionCtor() : undefined
  const [listening, setListening] = useState(false)
  const rec = useRef<SpeechRecognitionLike | null>(null)
  const callback = useRef(onTranscript)
  useEffect(() => {
    callback.current = onTranscript
  })
  useEffect(() => () => rec.current?.stop(), [])

  const start = useCallback(() => {
    if (!Ctor) return
    const r = new Ctor()
    r.lang = 'fa-IR'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? '')
        .join(' ')
        .trim()
      if (text) callback.current(text)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    setListening(true)
    try {
      r.start()
    } catch {
      setListening(false)
    }
  }, [Ctor])

  return { available: !!Ctor, listening, start, stop: () => rec.current?.stop() }
}
