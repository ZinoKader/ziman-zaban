import type { Skill, TargetLang } from '@/content/types'
import type { Candidate } from '@/lib/curriculum'
import type { Grade } from '@/lib/srs'

export interface ExerciseResult {
  grade: Grade
  /** Exercise variant, e.g. `mc-meaning`, `listen`, `typed-meaning`. Logged for analytics. */
  kind: string
  /** Time from showing the prompt to answering. */
  ms: number
}

export interface ExerciseProps {
  item: Candidate
  lang: TargetLang
  /** 0 for the first showing, 1+ when an item comes back after a miss in the same session. */
  attempt: number
  /** Call once the learner has seen feedback and pressed continue. */
  onDone: (result: ExerciseResult) => void
}

export interface SessionConfig {
  skill: Skill
  /** Renders one exercise. Use `key` on your component so state resets between items. */
  Exercise: React.ComponentType<ExerciseProps>
}
