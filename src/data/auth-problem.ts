export type AuthProblem =
  | 'wrong'
  | 'exists'
  | 'weak'
  | 'unconfirmed'
  | 'invalid-email'
  | 'busy'
  | 'guests-off'
  | 'offline'
  | 'failed'

export function isOffline(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const { name = '', message = '' } = (e ?? {}) as { name?: string; message?: string }
  return name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed|network request failed/i.test(message)
}

export function authProblem(e: unknown): AuthProblem {
  const code = (e as { code?: string } | null)?.code
  if (code === 'invalid_credentials') return 'wrong'
  if (code === 'user_already_exists' || code === 'email_exists') return 'exists'
  if (code === 'weak_password') return 'weak'
  if (code === 'email_not_confirmed') return 'unconfirmed'
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'invalid-email'
  if (code === 'anonymous_provider_disabled') return 'guests-off'
  if (code?.startsWith('over_')) return 'busy'
  return isOffline(e) ? 'offline' : 'failed'
}
