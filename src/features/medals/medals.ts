/** Words learned in one language that earn a medal. Learning every word of the course earns the last one. */
export const MILESTONES = [10, 25, 50, 100, 150, 200, 250] as const

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'star'

export function milestonesFor(total: number): number[] {
  return [...MILESTONES.filter((m) => m < total), total]
}

export function tierOf(words: number, total: number): MedalTier {
  if (words >= total) return 'star'
  if (words >= 150) return 'gold'
  if (words >= 50) return 'silver'
  return 'bronze'
}

/** Milestones reached but not yet awarded, lowest first. */
export function medalsToAward(learned: number, total: number, earned: readonly number[]): number[] {
  return milestonesFor(total).filter((m) => learned >= m && !earned.includes(m))
}

/** The next milestone still to reach, or null once every medal is earned. */
export function nextMilestone(learned: number, total: number, earned: readonly number[]): number | null {
  return milestonesFor(total).find((m) => !earned.includes(m) && m > learned) ?? null
}
