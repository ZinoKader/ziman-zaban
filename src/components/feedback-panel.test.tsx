import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackPanel } from './feedback-panel'

function mockPhone(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches && query.includes('max-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => vi.unstubAllGlobals())

describe('FeedbackPanel', () => {
  it('leads with the verdict and keeps secondary details collapsed until asked for', () => {
    const onContinue = vi.fn()
    render(
      <FeedbackPanel grade="wrong" onContinue={onContinue} details={<p>Plural: biran</p>}>
        <p>bira</p>
      </FeedbackPanel>,
    )
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByText('bira')).toBeInTheDocument()
    expect(screen.queryByText('Plural: biran')).not.toBeInTheDocument()
    const more = screen.getByRole('button', { name: 'More about this word' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Plural: biran')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('pins the continue button to the bottom of the screen on phones', () => {
    mockPhone(true)
    render(<FeedbackPanel grade="exact" onContinue={() => {}} />)
    const button = screen.getByRole('button', { name: 'Continue' })
    expect(screen.getByRole('status')).not.toContainElement(button)
    expect(button.closest('.fixed')).toHaveClass('bottom-0')
  })

  it('keeps the button inside the panel on larger screens, or when docking is off', () => {
    mockPhone(true)
    render(<FeedbackPanel grade="exact" onContinue={() => {}} dock={false} />)
    expect(screen.getByRole('status')).toContainElement(screen.getByRole('button', { name: 'Continue' }))
  })
})
