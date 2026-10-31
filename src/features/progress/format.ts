import type { BaseLang } from '@/content/types'

const locale = (lang: BaseLang) => (lang === 'sv' ? 'sv-SE' : 'en-GB')

/** "just now", "5 minutes ago", "2 hours ago", or a date and time for anything older. */
export function formatWhen(iso: string, lang: BaseLang, justNow: string, now = new Date()): string {
  const at = new Date(iso)
  const seconds = Math.round((now.getTime() - at.getTime()) / 1000)
  if (seconds < 45) return justNow
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' })
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), 'minute')
  if (seconds < 6 * 3600) return rtf.format(-Math.round(seconds / 3600), 'hour')
  return new Intl.DateTimeFormat(locale(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(at)
}

export function weekday(date: Date, lang: BaseLang, style: 'narrow' | 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: style }).format(date)
}

export function shortDate(date: Date, lang: BaseLang): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

export function formatBytes(n: number, lang: BaseLang): string {
  const fmt = new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 1 })
  if (n < 1024) return `${fmt.format(n)} B`
  if (n < 1024 * 1024) return `${fmt.format(n / 1024)} KB`
  return `${fmt.format(n / 1024 / 1024)} MB`
}
