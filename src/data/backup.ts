import { daysByLangFromLog, type Progress, type ReviewEntry } from '@/lib/progress'
import type { FullProgress } from './rows'

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export function readProgress(data: unknown): FullProgress | null {
  if (!isObject(data) || !isObject(data.cards) || !Array.isArray(data.log)) return null
  const log = data.log as ReviewEntry[]
  return {
    cards: data.cards as FullProgress['cards'],
    log,
    days: isObject(data.days) ? (data.days as FullProgress['days']) : {},
    daysByLang: isObject(data.daysByLang) ? (data.daysByLang as FullProgress['daysByLang']) : daysByLangFromLog(log),
    reports: Array.isArray(data.reports) ? (data.reports as FullProgress['reports']) : [],
    medals: isObject(data.medals) ? (data.medals as FullProgress['medals']) : {},
  }
}

export function parseBackup(text: string): FullProgress | null {
  try {
    return readProgress(JSON.parse(text))
  } catch {
    return null
  }
}

export function backupOf(p: Progress, log: ReviewEntry[]) {
  return { cards: p.cards, log, days: p.days, daysByLang: p.daysByLang, medals: p.medals }
}

export function isEmpty(p: FullProgress): boolean {
  return !p.log.length && !Object.keys(p.cards).length && !p.reports.length
}
