import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { buildQueue, DEFAULT_FILTERS } from './queue'
import { ReviewPage } from './review-page'
import { useReview } from './store'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/review']}>
      <TooltipProvider>
        <ReviewPage />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

const press = (key: string) => act(() => void fireEvent.keyDown(window, { key }))

describe('ReviewPage', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
    useSettings.setState({ baseLang: 'en' })
    useProgress.setState({ reports: [] })
    useReview.setState({ reviewer: '', lang: null, decisions: {}, filters: DEFAULT_FILTERS, cursor: {} })
  })

  it('asks for a name and language first', () => {
    renderPage()
    const start = screen.getByRole('button', { name: 'Start reviewing' })
    expect(start).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Aras' } })
    fireEvent.click(screen.getByRole('radio', { name: /Sorani Kurdish/ }))
    fireEvent.click(start)
    expect(useReview.getState()).toMatchObject({ reviewer: 'Aras', lang: 'ckb' })
    expect(screen.getByText('Reviewing as Aras')).toBeInTheDocument()
  })

  it('approves with A and advances in evidence order', () => {
    useReview.setState({ reviewer: 'Aras', lang: 'ckb' })
    const queue = buildQueue('ckb')
    renderPage()
    expect(screen.getByText(`1 / ${queue.length}`)).toBeInTheDocument()
    press('a')
    expect(useReview.getState().decisions[queue[0].key]?.verdict).toBe('correct')
    expect(screen.getByText(`2 / ${queue.length}`)).toBeInTheDocument()
    expect(screen.getByText(`1 of ${queue.length} reviewed`)).toBeInTheDocument()
    press('s')
    expect(screen.getByText(`3 / ${queue.length}`)).toBeInTheDocument()
    press('b')
    press('b')
    expect(screen.getByText(/You marked this correct/)).toBeInTheDocument()
  })

  it('requires a comment before flagging as incorrect', () => {
    useReview.setState({ reviewer: 'Aras', lang: 'ckb' })
    const first = buildQueue('ckb')[0]
    renderPage()
    press('x')
    const form = screen.getByRole('group', { name: 'What is wrong?' })
    fireEvent.click(within(form).getByRole('button', { name: /Save as incorrect/ }))
    expect(screen.getByText('Write the correct form or a short comment.')).toBeInTheDocument()
    expect(useReview.getState().decisions[first.key]).toBeUndefined()
    fireEvent.click(within(form).getByRole('button', { name: 'Spelling' }))
    fireEvent.change(within(form).getByLabelText('Comment'), { target: { value: 'wrong letter' } })
    fireEvent.click(within(form).getByRole('button', { name: /Save as incorrect/ }))
    expect(useReview.getState().decisions[first.key]).toMatchObject({ verdict: 'incorrect', comment: '[Spelling] — wrong letter' })
  })

  it('shows learner reports first, flagged', () => {
    useReview.setState({ reviewer: 'Aras', lang: 'ckb' })
    const last = buildQueue('ckb').at(-1)!
    useProgress.setState({ reports: [{ key: last.key, at: '2026-10-30T10:00:00Z', message: 'Looks misspelled' }] })
    renderPage()
    expect(screen.getByText('A learner reported a problem with this item')).toBeInTheDocument()
    expect(screen.getByText(/Looks misspelled/)).toBeInTheDocument()
    expect(screen.getByTitle(last.key)).toBeInTheDocument()
  })

  it('downloads the decisions as a review file', () => {
    useReview.setState({ reviewer: 'Aras Ahmed', lang: 'ckb' })
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => (created.push(b), 'blob:x')) as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^reviews-ckb-aras-ahmed-\d{4}-\d{2}-\d{2}\.json$/)
    })
    renderPage()
    press('a')
    fireEvent.click(screen.getByRole('button', { name: /Download 1 decision/ }))
    expect(click).toHaveBeenCalledOnce()
    expect(created).toHaveLength(1)
    click.mockRestore()
  })
})
