import { Download, Pause, Play, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { TargetLang } from '@/content/types'
import { buildRecordingZip, download, zipName } from './export'
import { takeKey, takesFor, useStudio, type TakeMeta } from './store'
import { studioStrings } from './strings'
import { loadAudio } from './takes-db'

function usePlayer() {
  const el = useRef<HTMLAudioElement | null>(null)
  const url = useRef<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const queue = useRef<TakeMeta[]>([])

  const release = () => {
    if (url.current) URL.revokeObjectURL(url.current)
    url.current = null
  }

  const play = async (t: TakeMeta): Promise<void> => {
    const bytes = await loadAudio(takeKey(t.lang, t.text))
    if (!bytes) return
    el.current ??= new Audio()
    el.current.pause()
    release()
    url.current = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
    el.current.src = url.current
    setPlaying(takeKey(t.lang, t.text))
    el.current.onended = () => {
      const next = queue.current.shift()
      if (next) void play(next)
      else setPlaying(null)
    }
    await el.current.play().catch(() => setPlaying(null))
  }

  const stop = () => {
    queue.current = []
    el.current?.pause()
    setPlaying(null)
  }

  const playAll = (takes: TakeMeta[]) => {
    queue.current = takes.slice(1)
    if (takes[0]) void play(takes[0])
  }

  useEffect(
    () => () => {
      el.current?.pause()
      if (url.current) URL.revokeObjectURL(url.current)
    },
    [],
  )

  return { playing, play: (t: TakeMeta) => ((queue.current = []), void play(t)), playAll, stop }
}

/** The takes on this device for one language: listen, delete, and download them as one file. */
export function RecordingsPanel({ lang }: { lang: TargetLang }) {
  const s = studioStrings.use()
  const all = useStudio((st) => st.takes)
  const speaker = useStudio((st) => st.speaker)
  const consentAt = useStudio((st) => st.consentAt)
  const removeTakes = useStudio((st) => st.removeTakes)
  const clear = useStudio((st) => st.clear)
  const takes = takesFor(all, lang).reverse()
  const player = usePlayer()
  const [busy, setBusy] = useState(false)

  const exportAll = async () => {
    setBusy(true)
    try {
      const files = []
      for (const meta of [...takes].reverse()) {
        const wav = await loadAudio(takeKey(lang, meta.text))
        if (wav) files.push({ meta, wav })
      }
      download(zipName(lang, speaker), buildRecordingZip({ lang, speaker, consentAt: consentAt ?? new Date().toISOString() }, files), 'application/zip')
      toast.success(s.downloaded)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>{s.reviewTitle}</CardTitle>
          <CardDescription>{takes.length ? s.reviewHint : s.none}</CardDescription>
        </CardHeader>
        {takes.length > 0 && (
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{s.count(takes.length)}</p>
              {player.playing ? (
                <Button variant="outline" size="sm" onClick={player.stop}>
                  <Pause /> {s.stop}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => player.playAll([...takes].reverse())}>
                  <Play /> {s.playAll}
                </Button>
              )}
            </div>
            <ul className="max-h-96 divide-y overflow-y-auto rounded-xl border">
              {takes.map((t) => {
                const key = takeKey(t.lang, t.text)
                const active = player.playing === key
                return (
                  <li key={key} className={active ? 'bg-primary/5' : undefined}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Button variant="ghost" size="icon" aria-label={s.play(t.latin)} onClick={() => (active ? player.stop() : player.play(t))}>
                        {active ? <Pause /> : <Play />}
                      </Button>
                      <div className="min-w-0 flex-1">
                        <p dir="rtl" lang={lang} className="truncate text-start font-script text-lg leading-snug">
                          {t.text}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.latin} · {(t.durationMs / 1000).toFixed(1)} s
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" aria-label={s.remove(t.latin)} onClick={() => void removeTakes([key])}>
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        )}
      </Card>
      <Card className="h-fit lg:col-span-2">
        <CardHeader>
          <CardTitle>{s.exportTitle}</CardTitle>
          <CardDescription>{s.exportHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full" size="lg" disabled={!takes.length || busy} onClick={() => void exportAll()}>
            <Download /> {s.download(takes.length)}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            disabled={!takes.length}
            onClick={() => {
              if (window.confirm(s.clearConfirm)) void clear(lang)
            }}
          >
            <Trash2 /> {s.clear}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
