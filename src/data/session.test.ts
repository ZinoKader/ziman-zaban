import { EMPTY_PROGRESS } from '@/lib/progress'
import { cardKey, Rating, reviewCard } from '@/lib/srs'
import { fetchProgress, fetchReviews, saveProgress } from './progress-api'
import { createAccount, ensureAccount, signIn, signOut } from './session'
import { supabase } from './supabase'

vi.unmock('@/data/session')
vi.mock('@/data/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInAnonymously: vi.fn(),
      updateUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}))

const auth = vi.mocked(supabase.auth)
const guest = { id: 'guest', email: undefined, is_anonymous: true }
const member = { id: 'member', email: 'sandra@example.com', is_anonymous: false }
const session = (user: object | null) => ({ data: { session: user ? { user } : null }, error: null }) as never

describe('ensureAccount', () => {
  it('keeps the current session', async () => {
    auth.getSession.mockResolvedValue(session(member))
    expect(await ensureAccount()).toEqual({ id: 'member', email: 'sandra@example.com', guest: false })
    expect(auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('starts a guest when nobody is signed in', async () => {
    auth.getSession.mockResolvedValue(session(null))
    auth.signInAnonymously.mockResolvedValue({ data: { user: guest, session: null }, error: null } as never)
    expect(await ensureAccount()).toEqual({ id: 'guest', email: null, guest: true })
  })
})

describe('signIn', () => {
  const water = cardKey('ckb', 'recognition', 'water')
  const at = new Date(2026, 2, 2, 9).toISOString()

  it('adds what a guest practised to the account', async () => {
    auth.getSession.mockResolvedValue(session(guest))
    vi.mocked(fetchProgress).mockResolvedValueOnce({ ...EMPTY_PROGRESS, cards: { [water]: reviewCard(undefined, Rating.Good, new Date(at)) } })
    vi.mocked(fetchReviews).mockResolvedValueOnce([{ key: water, grade: Rating.Good, at, ms: 900, kind: 'typed' }])
    auth.signInWithPassword.mockResolvedValue({ data: { user: member, session: {} }, error: null } as never)

    expect(await signIn('sandra@example.com', 'secret1', 'ckb')).toEqual({ ok: true })
    expect(saveProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        reviews: [expect.objectContaining({ item_id: 'water', is_new: true })],
        cards: [expect.objectContaining({ item_id: 'water' })],
      }),
    )
    expect(vi.mocked(fetchProgress).mock.invocationCallOrder[0]).toBeLessThan(auth.signInWithPassword.mock.invocationCallOrder[0])
  })

  it('reports a wrong password and saves nothing', async () => {
    auth.getSession.mockResolvedValue(session(member))
    auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { code: 'invalid_credentials' } } as never)
    expect(await signIn('sandra@example.com', 'nope', 'ckb')).toEqual({ ok: false, problem: 'wrong' })
    expect(saveProgress).not.toHaveBeenCalled()
  })
})

describe('createAccount', () => {
  it('asks to confirm the email while the user is still a guest', async () => {
    auth.updateUser.mockResolvedValue({ data: { user: guest }, error: null } as never)
    auth.getSession.mockResolvedValue(session(guest))
    expect(await createAccount('sandra@example.com', 'secret1')).toEqual({ ok: 'confirm' })
  })

  it('is done when the guest became a member', async () => {
    auth.updateUser.mockResolvedValue({ data: { user: member }, error: null } as never)
    auth.getSession.mockResolvedValue(session(member))
    expect(await createAccount('sandra@example.com', 'secret1')).toEqual({ ok: true })
  })

  it('maps errors to problems', async () => {
    auth.updateUser.mockResolvedValue({ data: { user: null }, error: { code: 'email_exists' } } as never)
    expect(await createAccount('sandra@example.com', 'secret1')).toEqual({ ok: false, problem: 'exists' })
  })
})

describe('signOut', () => {
  it('signs out on this browser and starts a new guest', async () => {
    auth.getSession.mockResolvedValue(session(null))
    auth.signInAnonymously.mockResolvedValue({ data: { user: guest, session: null }, error: null } as never)
    await signOut()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1)
  })
})
