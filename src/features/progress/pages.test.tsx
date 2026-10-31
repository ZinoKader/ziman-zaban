import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { conceptsFor } from '@/content'
import { cardKey, Rating, reviewCard } from '@/lib/srs'
import { HomePage } from '@/features/home/home-page'
import { SessionSummary } from '@/features/session/session-summary'
import { SettingsPage } from '@/features/settings/settings-page'
import { dayKey, useProgress } from '@/store/progress'
import { INITIAL_SAVE_STATUS, useSaveStatus } from '@/store/save-status'
import { useSettings } from '@/store/settings'
import { ProgressPage } from './progress-page'
import { SaveIndicator } from './save-indicator'

const words = conceptsFor('ckb')
const total = words.length

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="*" element={element} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

/** Three learned words (one forgotten twice on the way), two still in learning, a review history. */
function seed() {
  const now = new Date()
  const learned = reviewCard(undefined, Rating.Easy, now)
  let hard = learned
  for (let i = 0; i < 2; i++) {
    hard = reviewCard(hard, Rating.Again, new Date(hard.due))
    hard = reviewCard(hard, Rating.Easy, new Date(hard.due))
  }
  const learning = reviewCard(undefined, Rating.Good, now)
  const k = (i: number) => cardKey('ckb', 'recognition', words[i].id)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  useProgress.setState({
    cards: { [k(0)]: learned, [k(1)]: learned, [k(2)]: hard, [k(3)]: learning, [k(4)]: learning },
    log: [],
    days: {
      [dayKey(now)]: { reviews: 8, correct: 6, newItems: 2, ms: 60_000 },
      [dayKey(yesterday)]: { reviews: 12, correct: 12, newItems: 3, ms: 90_000 },
    },
    reports: [],
  })
  return { hardWord: words[2] }
}

beforeEach(() => {
  useSettings.setState({ baseLang: 'en', targetLang: 'ckb', onboarded: true, romanization: 'always', autoplayAudio: false })
  useProgress.setState({ cards: {}, log: [], days: {}, reports: [] })
  useSaveStatus.setState({ ...INITIAL_SAVE_STATUS, lastSavedAt: new Date().toISOString() })
})

describe('HomePage', () => {
  it('shows the course bar, module bars, today and streak', () => {
    seed()
    renderAt('/', <HomePage />)
    expect(screen.getByRole('heading', { name: 'Your Sorani course' })).toBeInTheDocument()
    expect(screen.getByText(`You know 3 of ${total} words`)).toBeInTheDocument()
    expect(screen.getByText('2 more on the way')).toBeInTheDocument()
    expect(screen.getByText(`${Math.round((3 / total) * 100)}%`)).toBeInTheDocument()
    const course = screen.getByRole('progressbar', { name: `You know 3 of ${total} words` })
    expect(course).toHaveAttribute('aria-valuenow', '3')
    expect(screen.getByRole('progressbar', { name: `Recognition: 3 of ${total} learned` })).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar', { name: /: 0 of \d+ learned/ })).toHaveLength(3)
    expect(screen.getByText('8 reviews done')).toBeInTheDocument()
    expect(screen.getByText('2-day streak')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See all progress/ })).toHaveAttribute('href', '/progress')
  })

  it('invites a new learner to start, in Swedish', () => {
    useSettings.setState({ baseLang: 'sv' })
    renderAt('/', <HomePage />)
    expect(screen.getByText(`Du kan 0 av ${total} ord`)).toBeInTheDocument()
    expect(screen.getByText('Ingen svit än')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Starta ditt första pass/ })).toHaveAttribute('href', '/learn/recognition/session')
  })
})

describe('ProgressPage', () => {
  it('renders course, units, activity, accuracy, forecast and hardest words', () => {
    const { hardWord } = seed()
    renderAt('/progress', <ProgressPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Your progress' })).toBeInTheDocument()
    expect(screen.getByText(`You know 3 of ${total} words`)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Units' })).toBeInTheDocument()
    expect(screen.getAllByText(/\/\d+ words$/).length).toBeGreaterThan(1)

    const chart = screen.getByRole('list', { name: 'Last 14 days' })
    expect(within(chart).getAllByRole('listitem')).toHaveLength(14)
    expect(screen.getByText('20 reviews')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('18 of 20 answers correct')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Coming up' })).getAllByRole('listitem')).toHaveLength(7)

    const link = screen.getByRole('link', { name: new RegExp(hardWord[`ckb`]!.primary.latin) })
    expect(link).toHaveAttribute('href', `/words/${hardWord.id}`)
    expect(within(link).getByText('forgotten 2×')).toBeInTheDocument()
  })

  it('shows Persian too once it has been started', () => {
    seed()
    useProgress.setState((s) => ({ cards: { ...s.cards, [cardKey('fa', 'recognition', conceptsFor('fa')[0].id)]: reviewCard(undefined, Rating.Good, new Date()) } }))
    renderAt('/progress', <ProgressPage />)
    expect(screen.getByText('Persian (Farsi)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Practise this language/ }))
    expect(useSettings.getState().targetLang).toBe('fa')
  })

  it('is friendly before any practice', () => {
    renderAt('/progress', <ProgressPage />)
    expect(screen.getByText('No reviews in the last 7 days.')).toBeInTheDocument()
    expect(screen.getByText(/No forgotten words so far/)).toBeInTheDocument()
  })
})

describe('SessionSummary', () => {
  it('confirms the save and shows newly learned words growing the course bar', () => {
    vi.useFakeTimers()
    const startMs = 60_000
    const word = words[0]
    const key = cardKey('ckb', 'recognition', word.id)
    useProgress.getState().record(key, Rating.Good, { ms: 1, kind: 'mc', now: new Date(Date.now() - 3 * 86_400_000) })
    useProgress.getState().record(key, Rating.Easy, { ms: 1, kind: 'mc' })
    renderAt(
      '/',
      <SessionSummary skill="recognition" stats={{ reviewed: 1, correctFirstTry: 1, newItems: 0, ms: startMs }} empty={false} onRestart={() => {}} onExit={() => {}} />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Progress saved')
    expect(screen.getByText('+1 word learned')).toBeInTheDocument()
    expect(screen.getByText(word.ckb!.primary.latin)).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: `You know 1 of ${total} words` })
    const solid = bar.firstElementChild as HTMLElement
    expect(solid.style.width).toBe('0%')
    act(() => void vi.advanceTimersByTime(400))
    expect(solid.style.width).not.toBe('0%')
    expect(screen.getByText('100%')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('warns when saving failed', () => {
    useProgress.getState().record(cardKey('ckb', 'recognition', words[1].id), Rating.Good, { ms: 1, kind: 'mc' })
    useSaveStatus.setState({ failed: true })
    renderAt(
      '/',
      <SessionSummary skill="recognition" stats={{ reviewed: 1, correctFirstTry: 1, newItems: 1, ms: 5000 }} empty={false} onRestart={() => {}} onExit={() => {}} />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Couldn't save/)
    expect(screen.getByText(/count as learned once they come back/)).toBeInTheDocument()
  })
})

describe('Saved indicator and Your data', () => {
  it('opens details about where and when progress was saved', () => {
    useSaveStatus.setState({ medium: 'indexeddb', persistSupported: true, persistent: true })
    renderAt('/', <SaveIndicator />)
    fireEvent.click(screen.getByRole('button', { name: 'Saved on this device' }))
    expect(screen.getByText('Last saved just now')).toBeInTheDocument()
    expect(screen.getByText(/browser's database on this device/)).toBeInTheDocument()
    expect(screen.getByText(/Protected/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Your data' })).toHaveAttribute('href', '/settings#data')
  })

  it('flags storage that will not survive the tab', () => {
    useSaveStatus.setState({ medium: 'memory' })
    renderAt('/', <SaveIndicator />)
    expect(screen.getByRole('button', { name: 'Not saved' })).toBeInTheDocument()
  })

  it('lists storage facts in Settings', () => {
    seed()
    useSaveStatus.setState({ medium: 'indexeddb', persistSupported: true, persistent: false })
    renderAt('/settings', <SettingsPage />)
    const data = document.getElementById('data')!
    expect(within(data).getByText('Your data')).toBeInTheDocument()
    expect(within(data).getByText(/5 cards, 0 reviews, 2 days of practice/)).toBeInTheDocument()
    expect(within(data).getByText(/Not protected yet/)).toBeInTheDocument()
    expect(within(data).getByRole('button', { name: /Ask the browser to keep it/ })).toBeInTheDocument()
    expect(within(data).getByText(/Syncing between your devices will come with accounts later/)).toBeInTheDocument()
    expect(within(data).getByRole('button', { name: /Export backup/ })).toBeInTheDocument()
    expect(within(data).getByRole('button', { name: /Import backup/ })).toBeInTheDocument()
  })
})
