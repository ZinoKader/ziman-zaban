import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cardKey, Rating, reviewCard } from '@/lib/srs'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { WordsPage } from './words-page'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/words" element={<WordsPage />} />
          <Route path="/words/:conceptId" element={<WordsPage />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

const search = () => screen.getByRole('searchbox', { name: 'Search words' })

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  useSettings.setState({ baseLang: 'en', targetLang: 'ckb', compare: true, showScript: true, romanization: 'always', autoplayAudio: false })
  useProgress.setState({ cards: {}, log: [], days: {}, reports: [] })
})

describe('WordsPage', () => {
  it('lists course words grouped by unit', () => {
    renderAt('/words')
    expect(screen.getByRole('heading', { level: 1, name: 'Words' })).toBeInTheDocument()
    const greetings = screen.getByRole('region', { name: /Greetings & courtesy/ })
    expect(within(greetings).getByText('سوپاس')).toBeInTheDocument()
    expect(within(greetings).getByText('supas')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Family/ })).toBeInTheDocument()
  })

  it('shows the other language in compare mode', () => {
    renderAt('/words')
    expect(screen.getAllByText('ممنون').length).toBeGreaterThan(0)
  })

  it('filters as you type, in Swedish and in script', () => {
    renderAt('/words')
    fireEvent.change(search(), { target: { value: 'tack' } })
    expect(screen.getByText('thank you')).toBeInTheDocument()
    expect(screen.queryByText('hello')).not.toBeInTheDocument()

    fireEvent.change(search(), { target: { value: 'خوشك' } })
    expect(screen.getByText('sister')).toBeInTheDocument()
    expect(screen.queryByText('thank you')).not.toBeInTheDocument()
  })

  it('shows a friendly empty state', () => {
    renderAt('/words?q=qqqq')
    expect(search()).toHaveValue('qqqq')
    expect(screen.getByText('No words match')).toBeInTheDocument()
    fireEvent.keyDown(search(), { key: 'Escape' })
    expect(screen.queryByText('No words match')).not.toBeInTheDocument()
  })

  it('applies filters from the URL', () => {
    renderAt('/words?unit=family')
    expect(screen.queryByRole('region', { name: /Greetings/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Family/ })).toBeInTheDocument()
  })

  it('shows strength dots from the progress store', () => {
    const now = new Date()
    useProgress.setState({ cards: { [cardKey('ckb', 'recognition', 'hello')]: reviewCard(undefined, Rating.Good, now) } })
    renderAt('/words?q=hello')
    expect(screen.getByRole('img', { name: 'Recognition: Learning, Recall: New' })).toBeInTheDocument()
  })

  it('opens a word with examples, stats and a practice link', () => {
    const card = reviewCard(reviewCard(undefined, Rating.Good, new Date()), Rating.Good, new Date())
    useProgress.setState({ cards: { [cardKey('ckb', 'recognition', 'i')]: card } })
    renderAt('/words/i')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Example sentences')).toBeInTheDocument()
    expect(within(dialog).getAllByText("I'm Sara.").length).toBeGreaterThan(0)
    expect(within(dialog).getByText('Reviews')).toBeInTheDocument()
    expect(within(dialog).getByText('Not started yet')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Practise this unit/ })).toHaveAttribute(
      'href',
      '/learn/recognition/session?unit=me-and-you',
    )
    expect(within(dialog).getByRole('link', { name: 'Personal pronouns' })).toHaveAttribute('href', '/grammar/ckb-pronouns')
  })

  it('handles an unknown word', () => {
    renderAt('/words/not-a-word')
    expect(screen.getByText('This word is not in the course for this language.')).toBeInTheDocument()
  })

  it('renders in Swedish and for Persian', () => {
    useSettings.setState({ baseLang: 'sv', targetLang: 'fa' })
    renderAt('/words')
    expect(screen.getByRole('heading', { level: 1, name: 'Ord' })).toBeInTheDocument()
    expect(screen.getAllByText('خداحافظ').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Sök ord' }), { target: { value: 'hej då' } })
    expect(screen.getByText('hej då')).toBeInTheDocument()
  })
})
