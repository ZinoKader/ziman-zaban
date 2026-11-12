import { fireEvent, render, screen } from '@testing-library/react'
import { queryClient } from '@/data/query-client'
import { createAccount, signIn, signOut } from '@/data/session'
import { ACCOUNT_KEY } from '@/store/account'
import { useSettings } from '@/store/settings'
import { AccountCard } from './account-card'

beforeEach(() => useSettings.setState({ baseLang: 'en', targetLang: 'ckb' }))

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
    queryClient.setQueryData(ACCOUNT_KEY, { id: 'm', email: 'sandra@example.com', guest: false })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AccountCard />)
    expect(screen.getByText('Signed in as sandra@example.com. Your progress is saved to this account after every answer.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await vi.waitFor(() => expect(signOut).toHaveBeenCalled())
  })
})
