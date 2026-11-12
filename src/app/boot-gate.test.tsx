import { fireEvent, render, screen } from '@testing-library/react'
import { BootGate } from './boot-gate'

describe('BootGate', () => {
  it('shows the app once boot is done', async () => {
    render(<BootGate start={async () => true}>app</BootGate>)
    expect(screen.getByText('Loading your progress…')).toBeInTheDocument()
    expect(await screen.findByText('app')).toBeInTheDocument()
  })

  it('offers a retry when the progress could not be loaded', async () => {
    const start = vi.fn<() => Promise<true>>().mockRejectedValue(new Error('offline'))
    render(<BootGate start={start}>app</BootGate>)
    expect(await screen.findByText(/Couldn't load your progress/, {}, { timeout: 3000 })).toBeInTheDocument()
    start.mockResolvedValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('app')).toBeInTheDocument()
  })
})
