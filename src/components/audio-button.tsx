import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { speak, useVoice } from '@/lib/audio'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'

export function useCanSpeak(lang: TargetLang, url?: string): boolean {
  const voice = useVoice(lang)
  return !!url || !!voice
}

interface AudioButtonProps {
  lang: TargetLang
  text: string
  url?: string
  autoPlay?: boolean
  size?: 'sm' | 'lg'
  className?: string
}

export function AudioButton({ lang, text, url, autoPlay, size = 'sm', className }: AudioButtonProps) {
  const voice = useVoice(lang)
  const s = common.use()
  const autoplaySetting = useSettings((st) => st.autoplayAudio)
  const available = !!url || !!voice
  const played = useRef<string | null>(null)

  useEffect(() => {
    if (!autoPlay || !autoplaySetting || !available || played.current === text) return
    played.current = text
    void speak({ lang, text, url, voice })
  }, [autoPlay, autoplaySetting, available, lang, text, url, voice])

  const button = (
    <Button
      type="button"
      variant="ghost"
      size={size === 'lg' ? 'icon-lg' : 'icon'}
      disabled={!available}
      onClick={(e) => {
        e.stopPropagation()
        void speak({ lang, text, url, voice })
      }}
      aria-label={available ? s.audio.play : s.audio.unavailable}
      className={cn('shrink-0 rounded-full text-primary', className)}
    >
      {available ? <Volume2 /> : <VolumeX className="opacity-50" />}
    </Button>
  )
  if (available) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent>{s.audio.unavailable}</TooltipContent>
    </Tooltip>
  )
}
