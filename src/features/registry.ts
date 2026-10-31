import type { ComponentType } from 'react'
import type { Skill } from '@/content/types'
import { ConstructionExercise } from './construction/construction-exercise'
import { RecallExercise } from './recall/recall-exercise'
import { RecognitionExercise } from './recognition/recognition-exercise'
import { ResponseExercise } from './response/response-exercise'
import type { ExerciseProps } from './session/types'

/** The exercise component each module's sessions render. */
export const EXERCISES: Record<Skill, ComponentType<ExerciseProps>> = {
  recognition: RecognitionExercise,
  recall: RecallExercise,
  construction: ConstructionExercise,
  response: ResponseExercise,
}
