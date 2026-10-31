import type { BaseLang } from '@/content/types'

export const LOCALE: Record<BaseLang, string> = { en: 'en-GB', sv: 'sv-SE' }

/** "in 3 days", "om 2 timmar"... Past dates return null (the card is due). */
export function formatRelative(target: Date, now: Date, lang: BaseLang): string | null {
  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return null
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' })
  const minutes = Math.round(diff / 60_000)
  if (minutes < 60) return rtf.format(Math.max(1, minutes), 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 45) return rtf.format(days, 'day')
  return rtf.format(Math.round(days / 30), 'month')
}

export function formatDate(d: Date, lang: BaseLang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}
