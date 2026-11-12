import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { queryClient } from '@/data/query-client'
import { createAccount, signIn, signOut } from '@/data/session'
import { ACCOUNT_KEY } from '@/store/account'
import { useSettings } from '@/store/settings'
import { patchProgress } from '@/test/progress'
import { AccountCard } from './account-card'
import { AccountMenu } from './account-menu'
import { AccountPrompt } from './account-prompt'
import { shouldPrompt } from './prompt'

beforeEach(() => useSettings.setState({ baseLang: 'en', targetLang: 'ckb', accountPromptHiddenAt: null }))

const member = () => queryClient.setQueryData(ACCOUNT_KEY, { id: 'm', email: 'sandra@example.com', guest: false })

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

describe('AccountCard', () => {
  it('turns the guest into an account', async () => {
    render(<AccountCard />)
    expect(await screen.findByText(/practising as a guest/)).toBeInTheDocument()
    fill('sandra@example.com', 'secret1')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await vi.waitFor(() => expect(createAccount).toHaveBeenCalledWith('sandra@example.com', 'secret1'))
  })

  it('explains why signing in did not work', async () => {
    vi.mocked(signIn).mockResolvedValueOnce({ ok: false, problem: 'wrong' })
    render(<AccountCard />)
    fireEvent.click(screen.getByRole('button', { name: 'I already have an account' }))
    expect(screen.getByText(/practised as a guest is added to the account/)).toBeInTheDocument()
    fill('sandra@example.com', 'nope123')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.')
    expect(signIn).toHaveBeenCalledWith('sandra@example.com', 'nope123', 'ckb')
  })

  it('asks to confirm the email when the project requires it', async () => {
    vi.mocked(createAccount).mockResolvedValueOnce({ ok: 'confirm' })
    render(<AccountCard />)
    fill('sandra@example.com', 'secret1')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Check your email/)
  })

  it('signs a member out after asking', async () => {
    member()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AccountCard />)
    expect(screen.getByText('Signed in as sandra@example.com. Your progress is saved to this account after every answer.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await vi.waitFor(() => expect(signOut).toHaveBeenCalled())
  })
})

describe('AccountMenu', () => {
  const renderMenu = () =>
    render(
      <MemoryRouter>
        <AccountMenu />
      </MemoryRouter>,
    )

  it('opens a sign-in form for guests and closes once the account exists', async () => {
    renderMenu()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in or create an account' }))
    expect(screen.getByText('Keep your progress')).toBeInTheDocument()
    fill('sandra@example.com', 'secret1')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await vi.waitFor(() => expect(screen.queryByText('Keep your progress')).not.toBeInTheDocument())
    expect(createAccount).toHaveBeenCalledWith('sandra@example.com', 'secret1')
  })

  it('marks the button once a guest has practised', async () => {
    const { container } = renderMenu()
    await screen.findByRole('button', { name: 'Sign in or create an account' })
    expect(container.querySelector('.bg-primary')).toBeNull()
    patchProgress({ cards: { 'ckb:recognition:x': { due: 0 } as never } })
    expect(container.querySelector('.bg-primary')).not.toBeNull()
  })

  it('shows the member initial and offers settings and sign out', () => {
    member()
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Signed in as sandra@example.com' }))
    expect(screen.getByRole('link', { name: 'Account settings' })).toHaveAttribute('href', '/settings#account')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})

describe('AccountPrompt', () => {
  it('asks guests to create an account in a dialog', async () => {
    render(<AccountPrompt />)
    expect(await screen.findByText('Keep what you learned')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Keep your progress')
  })

  it('stays away for a week after Not now', async () => {
    render(<AccountPrompt />)
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('Keep what you learned')).not.toBeInTheDocument()
    const hiddenAt = useSettings.getState().accountPromptHiddenAt!
    const at = Date.parse(hiddenAt)
    expect(shouldPrompt(hiddenAt, at + 6 * 86_400_000)).toBe(false)
    expect(shouldPrompt(hiddenAt, at + 7 * 86_400_000)).toBe(true)
  })

  it('is hidden for members', () => {
    member()
    const { container } = render(<AccountPrompt />)
    expect(container).toBeEmptyDOMElement()
  })
})
