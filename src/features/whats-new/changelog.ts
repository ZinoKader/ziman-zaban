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

export const latestRelease: string | null = changelog.en[0]?.date ?? null

export function hasUnseen(seen: string | null): boolean {
  return latestRelease !== null && (seen === null || seen < latestRelease)
}

/** Number of changes in releases newer than `seen`. */
export function unseenCount(seen: string | null, releases: Release[] = changelog.en): number {
  return releases.filter((r) => seen === null || r.date > seen).reduce((n, r) => n + r.changes.length, 0)
}
