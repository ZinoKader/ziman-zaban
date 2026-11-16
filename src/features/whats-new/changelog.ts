import en from '../../../CHANGELOG.md?raw'
import sv from '../../../CHANGELOG.sv.md?raw'
import type { BaseLang } from '@/content/types'

export interface Change {
  /** The part before the colon, e.g. "Recall". */
  area: string | null
  text: string
}

export interface Release {
  /** YYYY-MM-DD */
  date: string
  changes: Change[]
}

/** Reads `## YYYY-MM-DD` headings and the `- Area: text` bullets under them. Everything else is ignored. */
export function parseChangelog(md: string): Release[] {
  const releases: Release[] = []
  for (const raw of md.split('\n')) {
    const line = raw.trim()
    const heading = /^## (\d{4}-\d{2}-\d{2})$/.exec(line)
    if (heading) {
      releases.push({ date: heading[1], changes: [] })
      continue
    }
    const bullet = /^- (.+)$/.exec(line)
    if (!bullet || !releases.length) continue
    const parts = /^([^:]{1,40}): (.+)$/.exec(bullet[1])
    releases[releases.length - 1].changes.push(parts ? { area: parts[1], text: parts[2] } : { area: null, text: bullet[1] })
  }
  return releases
}

export const changelog: Record<BaseLang, Release[]> = { en: parseChangelog(en), sv: parseChangelog(sv) }

/**
 * What the learner has seen, as `YYYY-MM-DD#n`: the newest date and how many of its changes it had.
 * A day can get more changes after it went live, and new ones go at the top of that day's list.
 * Older settings hold only the date, which counts as none of that day's changes seen.
 */
export function releaseMark(releases: Release[] = changelog.en): string | null {
  const latest = releases[0]
  return latest ? `${latest.date}#${latest.changes.length}` : null
}

export const latestRelease = releaseMark()

/** Number of changes newer than `seen`. */
export function unseenCount(seen: string | null, releases: Release[] = changelog.en): number {
  if (seen === null) return releases.reduce((n, r) => n + r.changes.length, 0)
  const [date, count] = seen.split('#')
  const seenOnDate = Number(count) || 0
  return releases.reduce((n, r) => {
    if (r.date > date) return n + r.changes.length
    if (r.date === date) return n + Math.max(0, r.changes.length - seenOnDate)
    return n
  }, 0)
}

export function hasUnseen(seen: string | null, releases: Release[] = changelog.en): boolean {
  return unseenCount(seen, releases) > 0
}
