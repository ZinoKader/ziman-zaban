import type { TargetLang } from '@/content/types'

/** The conversation partner who asks the questions. */
export const SPEAKERS: Record<TargetLang, { name: string; initial: string }> = {
  ckb: { name: 'Shilan', initial: 'ش' },
  fa: { name: 'Maryam', initial: 'م' },
}
