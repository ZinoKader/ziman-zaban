import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { EXERCISES } from '@/features/registry'
import { moduleBySlug } from '@/features/modules'
import { useSettings } from '@/store/settings'
import { SessionRunner } from './session-runner'
import { useSessionQueue } from './use-session'
import type { Skill, TargetLang } from '@/content/types'

export function SessionPage() {
  const { module: slug } = useParams()
  const meta = slug ? moduleBySlug.get(slug) : undefined
  const lang = useSettings((s) => s.targetLang)
  if (!meta) return <Navigate to="/" replace />
  // Remount when the language changes so the queue is rebuilt.
  return <Session key={`${meta.skill}:${lang}`} skill={meta.skill} slug={meta.slug} lang={lang} />
}

function Session({ skill, slug, lang }: { skill: Skill; slug: string; lang: TargetLang }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const unit = params.get('unit')
  const { queue, generation, restart } = useSessionQueue(skill, lang, { units: unit ? [unit] : undefined })
  return (
    <SessionRunner
      key={generation}
      skill={skill}
      lang={lang}
      queue={queue}
      Exercise={EXERCISES[skill]}
      onExit={() => navigate(`/learn/${slug}`)}
      onHome={() => navigate('/')}
      onRestart={restart}
    />
  )
}
