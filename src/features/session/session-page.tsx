import { useMemo } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { EXERCISES } from '@/features/registry'
import { moduleBySlug } from '@/features/modules'
import { useSettings } from '@/store/settings'
import { SessionRunner } from './session-runner'
import { useSessionQueue, type SessionKind } from './use-session'
import type { Skill, TargetLang } from '@/content/types'

export function SessionPage() {
  const { module: slug } = useParams()
  const [params] = useSearchParams()
  const meta = slug ? moduleBySlug.get(slug) : undefined
  const lang = useSettings((s) => s.targetLang)
  if (!meta) return <Navigate to="/" replace />
  // Remount when the language or the requested session changes so the queue is rebuilt.
  return <Session key={`${meta.skill}:${lang}:${params.toString()}`} skill={meta.skill} slug={meta.slug} lang={lang} />
}

const KINDS: readonly SessionKind[] = ['mixed', 'new', 'reviews']

function Session({ skill, slug, lang }: { skill: Skill; slug: string; lang: TargetLang }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const unit = params.get('unit')
  const units = useMemo(() => (unit ? [unit] : undefined), [unit])
  const kindParam = params.get('kind') as SessionKind | null
  const kind = kindParam && KINDS.includes(kindParam) ? kindParam : 'mixed'
  const { queue, generation, restart } = useSessionQueue(skill, lang, { units, kind })
  return (
    <SessionRunner
      key={generation}
      skill={skill}
      lang={lang}
      queue={queue}
      units={units}
      Exercise={EXERCISES[skill]}
      onExit={() => navigate(`/learn/${slug}`)}
      onHome={() => navigate('/')}
      onRestart={restart}
    />
  )
}
