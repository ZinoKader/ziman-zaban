import type { User } from '@supabase/supabase-js'
import type { TargetLang } from '@/content/types'
import { authProblem, type AuthProblem } from './auth-problem'
import { fetchProgress, fetchReviews, saveProgress } from './progress-api'
import { progressRows } from './rows'
import { supabase } from './supabase'

export interface Account {
  id: string
  email: string | null
  guest: boolean
}

export type AuthOutcome = { ok: true } | { ok: false; problem: AuthProblem } | { ok: 'confirm' }

const accountOf = (u: User): Account => ({ id: u.id, email: u.email ?? null, guest: !!u.is_anonymous })

function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks ? locks.request(name, fn) : fn()
}

export async function currentAccount(): Promise<Account | null> {
  const { data } = await supabase.auth.getSession()
  return data.session ? accountOf(data.session.user) : null
}

export function ensureAccount(): Promise<Account> {
  return withLock('zz-account', async () => {
    const existing = await currentAccount()
    if (existing) return existing
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    if (!data.user) throw new Error('No user after guest sign-in')
    return accountOf(data.user)
  })
}

async function attempt(run: () => Promise<AuthOutcome>): Promise<AuthOutcome> {
  try {
    return await run()
  } catch (e) {
    return { ok: false, problem: authProblem(e) }
  }
}

export function createAccount(email: string, password: string): Promise<AuthOutcome> {
  return attempt(async () => {
    const { error } = await supabase.auth.updateUser({ email, password })
    if (error) return { ok: false, problem: authProblem(error) }
    const account = await currentAccount()
    return account && !account.guest && account.email === email ? { ok: true } : { ok: 'confirm' }
  })
}

async function guestRows(fallback: TargetLang) {
  const account = await currentAccount()
  if (!account?.guest) return null
  const [progress, log] = await Promise.all([fetchProgress(), fetchReviews()])
  return log.length || Object.keys(progress.cards).length ? progressRows({ ...progress, log }, fallback) : null
}

export function signIn(email: string, password: string, fallback: TargetLang): Promise<AuthOutcome> {
  return attempt(async () => {
    const carried = await guestRows(fallback)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, problem: authProblem(error) }
    if (!data.session) return { ok: 'confirm' }
    if (carried) await saveProgress(carried)
    return { ok: true }
  })
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' })
  await ensureAccount()
}
