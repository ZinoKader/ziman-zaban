import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { conceptsFor } from '@/content'
import { buildQueue, type Candidate } from '@/lib/curriculum'
import { cardKey, isLearned, Rating, State, type Grade } from '@/lib/srs'
import { HomePage } from '@/features/home/home-page'
import { useProgress } from '@/store/progress'
import { INITIAL_SAVE_STATUS, useSaveStatus } from '@/store/save-status'
import { useSettings } from '@/store/settings'
import { SessionRunner } from './session-runner'
import type { ExerciseProps } from './types'

const words = conceptsFor('ckb')
const total = words.length

interface Shown {
  itemId: string
  attempt: number
  isNew: boolean
  reps: number | undefined
}

/** Answers with whatever `grade` says for the item; records what it was shown. */
function fakeExercise(grade: (itemId: string, showing: number) => Grade, shown: Shown[]) {
  return function FakeExercise({ item, attempt, onDone }: ExerciseProps) {
    return (
      <button
        onClick={() => {
          const showing = shown.filter((s) => s.itemId === item.itemId).length
          shown.push({ itemId: item.itemId, attempt, isNew: item.isNew, reps: item.card?.reps })
          onDone({ grade: grade(item.itemId, showing), kind: 'fake', ms: 1500 })
        }}
      >
        answer
      </button>
    )
  }
}

function renderRunner(queue: Candidate[], Exercise: React.ComponentType<ExerciseProps>) {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <SessionRunner skill="recognition" lang="ckb" queue={queue} Exercise={Exercise} onExit={() => {}} onRestart={() => {}} />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

function answerAll() {
  for (let i = 0; i < 100 && screen.queryByRole('button', { name: 'answer' }); i++) {
    fireEvent.click(screen.getByRole('button', { name: 'answer' }))
  }
}

const firstSession = () =>
  buildQueue('recognition', 'ckb', useProgress.getState().cards, { size: 15, maxNew: 6 })

const summaryRow = (title: string) => screen.getByText(title, { selector: 'span.font-medium' }).parentElement!

beforeEach(() => {
  useSettings.setState({ baseLang: 'en', targetLang: 'ckb', onboarded: true, autoplayAudio: false })
  useProgress.setState({ cards: {}, log: [], days: {}, reports: [] })
  useSaveStatus.setState({ ...INITIAL_SAVE_STATUS })
})

describe('SessionRunner', () => {
  it('brings each new word back once, so answering it right twice learns it the same day', () => {
    const shown: Shown[] = []
    const queue = firstSession()
    expect(queue).toHaveLength(6)
    renderRunner(queue, fakeExercise(() => Rating.Good, shown))
    answerAll()

    expect(shown).toHaveLength(12)
    for (const q of queue) {
      const showings = shown.filter((s) => s.itemId === q.itemId)
      expect(showings).toHaveLength(2)
      // The repeat carries the card as it is now, not the snapshot from when the session started.
      expect(showings[1]).toMatchObject({ isNew: false, reps: 1, attempt: 0 })
      const between = shown.indexOf(showings[1]) - shown.indexOf(showings[0]) - 1
      expect(between).toBeGreaterThan(0)
    }
    const cards = useProgress.getState().cards
    expect(queue.every((q) => cards[q.key]?.state === State.Review)).toBe(true)

    expect(summaryRow('Words learned')).toHaveTextContent(`6/${total}`)
    expect(summaryRow('Words learned')).not.toHaveTextContent('in progress')
    expect(screen.getByText('+6 words learned')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows the same numbers on the home page straight after the session', () => {
    const { unmount } = renderRunner(firstSession(), fakeExercise(() => Rating.Good, []))
    answerAll()
    screen.getByText('+6 words learned')
    unmount()
    render(
      <MemoryRouter>
        <TooltipProvider>
          <HomePage />
        </TooltipProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('progressbar', { name: `You know 6 of ${total} words` })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: `Recognition: 6 of ${total} learned` })).toBeInTheDocument()
  })

  it('keeps a missed word in progress until it is answered right twice', () => {
    const shown: Shown[] = []
    const queue = firstSession().slice(0, 2)
    const missed = queue[0].itemId
    renderRunner(queue, fakeExercise((id, showing) => (id === missed && showing === 0 ? Rating.Again : Rating.Good), shown))
    answerAll()

    const showings = shown.filter((s) => s.itemId === missed)
    expect(showings.map((s) => s.attempt)).toEqual([0, 1, 1])
    expect(isLearned(useProgress.getState().cards[queue[0].key])).toBe(true)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('records an answer once even if Continue fires twice', () => {
    const queue = firstSession().slice(0, 2)
    let calls = 0
    function DoubleTap({ onDone }: ExerciseProps) {
      return (
        <button
          onClick={() => {
            calls++
            onDone({ grade: Rating.Good, kind: 'fake', ms: 1 })
            onDone({ grade: Rating.Good, kind: 'fake', ms: 1 })
          }}
        >
          answer
        </button>
      )
    }
    renderRunner(queue, DoubleTap)
    fireEvent.click(screen.getByRole('button', { name: 'answer' }))
    expect(useProgress.getState().log).toHaveLength(1)
    expect(useProgress.getState().cards[queue[0].key]!.reps).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'answer' }))
    expect(calls).toBe(2)
    expect(useProgress.getState().log).toHaveLength(2)
  })

  it('freezes the session time once it is over', () => {
    vi.useFakeTimers()
    try {
      renderRunner(firstSession().slice(0, 1), fakeExercise(() => Rating.Easy, []))
      act(() => void vi.advanceTimersByTime(3000))
      answerAll()
      expect(screen.getByText('3s')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(60_000)
        useSettings.setState({ baseLang: 'sv' })
      })
      expect(screen.getByText('3s')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a quick second session reviews words still in their learning steps instead of only adding new ones', () => {
    const queue = firstSession()
    const last = queue.at(-1)!
    // Hard keeps a new word in its learning steps even after the in-session repeat.
    renderRunner(queue, fakeExercise((id) => (id === last.itemId ? Rating.Hard : Rating.Good), []))
    answerAll()
    expect(useProgress.getState().cards[last.key]!.state).toBe(State.Learning)

    const next = buildQueue('recognition', 'ckb', useProgress.getState().cards, { size: 15, maxNew: 6 })
    expect(next.filter((c) => !c.isNew).map((c) => c.key)).toEqual([last.key])
    expect(next.filter((c) => c.isNew)).toHaveLength(6)
    expect(next.some((c) => c.key === cardKey('ckb', 'recognition', words[0].id))).toBe(false)
  })
})
