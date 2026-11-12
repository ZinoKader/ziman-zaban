import type { PostgrestError } from '@supabase/supabase-js'
import type { TargetLang } from '@/content/types'
import type { Progress, ReviewEntry } from '@/lib/progress'
import type { Settings } from '@/store/settings'
import type { TablesInsert } from './database.types'
import { progressFromRows, reviewFromRow, type ProgressRows } from './rows'
import { supabase } from './supabase'

const PAGE = 1000

type Result<T> = PromiseLike<{ data: T | null; error: PostgrestError | null }>

async function unwrap<T>(run: Result<T>): Promise<T | null> {
  const { data, error } = await run
  if (error) throw error
  return data
}

async function every<T>(page: (from: number, to: number) => Result<T[]>): Promise<T[]> {
  const out: T[] = []
  for (;;) {
    const rows = (await unwrap(page(out.length, out.length + PAGE - 1))) ?? []
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Not signed in')
  return data.session.user.id
}

export async function fetchProgress(): Promise<Progress> {
  const uid = await currentUserId()
  const [cards, days, medals, reports] = await Promise.all([
    every((a, b) =>
      supabase.from('cards').select('*').eq('user_id', uid).order('lang').order('skill').order('item_id').range(a, b),
    ),
    every((a, b) => supabase.from('daily_totals').select('*').eq('user_id', uid).order('lang').order('day').range(a, b)),
    every((a, b) => supabase.from('medals').select('*').eq('user_id', uid).order('lang').order('words').range(a, b)),
    every((a, b) => supabase.from('content_reports').select('*').eq('user_id', uid).order('id').range(a, b)),
  ])
  return progressFromRows({ cards, days, medals, reports })
}

export async function fetchReviews(): Promise<ReviewEntry[]> {
  const uid = await currentUserId()
  const rows = await every((a, b) => supabase.from('reviews').select('*').eq('user_id', uid).order('id').range(a, b))
  return rows.map(reviewFromRow)
}

export async function saveProgress(rows: ProgressRows): Promise<void> {
  await unwrap(supabase.rpc('save_progress', { data: rows }))
}

export async function saveMedals(rows: TablesInsert<'medals'>[]): Promise<void> {
  await unwrap(supabase.from('medals').upsert(rows, { onConflict: 'user_id,lang,words', ignoreDuplicates: true }))
}

export async function saveReport(row: TablesInsert<'content_reports'>): Promise<void> {
  await unwrap(
    supabase.from('content_reports').upsert(row, { onConflict: 'user_id,item_key,created_at', ignoreDuplicates: true }),
  )
}

export async function resetLanguage(lang: TargetLang, at: string): Promise<void> {
  await unwrap(supabase.rpc('reset_language', { target: lang, reset_at: at }))
}

export interface SavedSettings {
  settings: Partial<Settings>
  changedAt: string | null
}

export async function fetchSettings(): Promise<SavedSettings | null> {
  const uid = await currentUserId()
  const { data, error } = await supabase
    .from('profiles')
    .select('settings, settings_updated_at')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  return data ? { settings: data.settings as Partial<Settings>, changedAt: data.settings_updated_at } : null
}

export async function saveSettings(settings: Settings, changedAt?: string): Promise<void> {
  await unwrap(supabase.rpc('save_settings', { settings, changed_at: changedAt }))
}
