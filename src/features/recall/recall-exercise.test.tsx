import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Candidate } from '@/lib/curriculum'
import { seededRandom } from '@/lib/distractors'
import { newCard, Rating, State } from '@/lib/srs'
import { getProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import type { ExerciseResult } from '../session/types'
import { chooseMode, modeSeed } from './grading'
import { RecallExercise } from './recall-exercise'
import { seedProgress } from '@/test/progress'

const newItem: Candidate = { key: 'ckb:recall:thank-you', itemId: 'thank-you', isNew: true, order: 0 }
/** Past the options stage and not yet stable enough to be asked aloud: typed. */
const reviewed: Candidate = { ...newItem, isNew: false, card: { ...newCard(new Date()), reps: 3, stability: 3, state: State.Review } }

function renderExercise(item: Candidate = reviewed, attempt = 0) {
  const onDone = vi.fn<(r: ExerciseResult) => void>()
  render(
    <MemoryRouter>
      <TooltipProvider>
        <RecallExercise item={item} lang="ckb" attempt={attempt} onDone={onDone} />
      </TooltipProvider>
    </MemoryRouter>,
  )
  return onDone
}

function answer(text: string) {
  const input = screen.getByPlaceholderText('Latin or Arabic letters')
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

const button = (name: RegExp | string) => screen.getByRole('button', { name })

beforeEach(() => {
  useSettings.setState({ baseLang: 'en', targetLang: 'ckb', answerScript: 'latin', recallAnswer: 'type', romanization: 'always', compare: true, showScript: true, autoplayAudio: false })
  seedProgress()
})

describe('RecallExercise', () => {
  it('shows the meaning but never the target word before answering', () => {
    renderExercise()
    expect(screen.getByTestId('recall-gloss')).toHaveTextContent('thank you')
    expect(screen.getByText('How do you say this in Sorani?')).toBeInTheDocument()
    expect(screen.getByText('interjection')).toBeInTheDocument()
    expect(screen.queryByText('سوپاس')).not.toBeInTheDocument()
    expect(screen.queryByText('supas')).not.toBeInTheDocument()
  })

  it('uses the base language from settings', () => {
    useSettings.setState({ baseLang: 'sv' })
    renderExercise()
    expect(screen.getByTestId('recall-gloss')).toHaveTextContent('tack')
    expect(screen.getByText('Hur säger man det här på sorani?')).toBeInTheDocument()
  })

  it('grades a correct typed answer Good or Easy and shows the word with the other language', () => {
    const onDone = renderExercise()
    answer('supas')
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText('سوپاس')).toBeInTheDocument()
    expect(screen.getByText('supas')).toBeInTheDocument()
    expect(screen.queryByText('In Persian')).not.toBeInTheDocument()
    fireEvent.click(button('More about this word'))
    expect(screen.getByText('In Persian')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone).toHaveBeenCalledTimes(1)
    const result = onDone.mock.calls[0][0]
    expect([Rating.Good, Rating.Easy]).toContain(result.grade)
    expect(result.kind).toBe('recall-typed')
  })

  it('accepts Arabic script too', () => {
    const onDone = renderExercise()
    answer('سوپاس')
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBeGreaterThanOrEqual(Rating.Good)
  })

  it('does not award Easy on a re-ask', () => {
    const onDone = renderExercise(reviewed, 1)
    answer('supas')
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBe(Rating.Good)
  })

  it('grades a wrong answer Again, with a diff and copy practice that can be skipped', () => {
    const onDone = renderExercise()
    answer('sipaz')
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByTestId('answer-diff')).toBeInTheDocument()
    fireEvent.click(button('Type it once'))
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByText('Type it once to lock it in')).toBeInTheDocument()
    fireEvent.click(button('Skip'))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone.mock.calls[0][0].grade).toBe(Rating.Again)
  })

  it('lets the learner copy the correct form after a miss', () => {
    const onDone = renderExercise()
    fireEvent.click(button("I don't know"))
    fireEvent.click(button('Type it once'))
    const copy = screen.getByPlaceholderText('Copy the word')
    fireEvent.change(copy, { target: { value: 'nan' } })
    fireEvent.keyDown(copy, { key: 'Enter' })
    expect(screen.getByText(/Not quite the same/)).toBeInTheDocument()
    fireEvent.change(copy, { target: { value: 'supas' } })
    fireEvent.keyDown(copy, { key: 'Enter' })
    expect(screen.getByText('Well done.')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBe(Rating.Again)
  })

  it('caps the grade at Hard after a hint', () => {
    const onDone = renderExercise()
    fireEvent.click(button(/Hint/))
    expect(screen.getByRole('note')).toHaveAccessibleName('Hint: 1 of 5 letters shown')
    expect(screen.getByText(/5 letters/)).toBeInTheDocument()
    answer('supas')
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBe(Rating.Hard)
  })

  it('opens and extends hints from the keyboard', () => {
    renderExercise()
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByRole('note')).toHaveAccessibleName('Hint: 1 of 5 letters shown')
    fireEvent.keyDown(window, { key: 'h', ctrlKey: true })
    expect(screen.getByRole('note')).toHaveAccessibleName('Hint: 2 of 5 letters shown')
  })

  it('lets the learner override a wrong judgement and files a report', () => {
    const onDone = renderExercise()
    answer('tashakor')
    fireEvent.click(button('I was right'))
    expect(screen.getByText(/Counted as correct/)).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0]).toMatchObject({ grade: Rating.Good, kind: 'recall-override' })
    const reports = getProgress().reports
    expect(reports).toHaveLength(1)
    expect(reports[0].key).toBe('concept:ckb:thank-you')
    expect(reports[0].message).toContain('tashakor')
  })

  it('asks well-known words out loud and lets the learner grade themselves', () => {
    let item: Candidate | undefined
    for (let reps = 1; reps < 50 && !item; reps++) {
      const card = { ...newCard(new Date()), stability: 30, reps, state: State.Review }
      const candidate: Candidate = { ...reviewed, card }
      if (chooseMode(candidate, 0, seededRandom(modeSeed(candidate, 0)), 'type') === 'spoken') item = candidate
    }
    const onDone = renderExercise(item!)
    expect(screen.getByText('Say it out loud in Sorani')).toBeInTheDocument()
    expect(screen.queryByText('سوپاس')).not.toBeInTheDocument()
    fireEvent.click(button('Show answer'))
    expect(screen.getByText('سوپاس')).toBeInTheDocument()
    fireEvent.click(button('Good'))
    expect(onDone.mock.calls[0][0]).toMatchObject({ grade: Rating.Good, kind: 'recall-spoken' })
  })

  it('lets a new word be picked among four options, never above Good', () => {
    const onDone = renderExercise(newItem)
    expect(screen.getByText('Which is the Sorani word?')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Latin or Arabic letters')).not.toBeInTheDocument()
    const options = within(screen.getByRole('group')).getAllByRole('button')
    expect(options).toHaveLength(4)
    fireEvent.click(options.find((o) => o.textContent?.includes('supas'))!)
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0]).toMatchObject({ grade: Rating.Good, kind: 'recall-choose' })
  })

  it('grades a wrong pick Again and shows the right word', () => {
    const onDone = renderExercise(newItem)
    const options = within(screen.getByRole('group')).getAllByRole('button')
    fireEvent.click(options.find((o) => !o.textContent?.includes('supas'))!)
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBe(Rating.Again)
  })

  it('always offers four options to learners who prefer them, even for well-known words', () => {
    useSettings.setState({ recallAnswer: 'choose' })
    const known: Candidate = { ...reviewed, card: { ...reviewed.card!, reps: 12, stability: 60 } }
    const onDone = renderExercise(known)
    expect(screen.getByRole('tab', { name: 'Options' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByPlaceholderText('Latin or Arabic letters')).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('group')).getAllByRole('button').find((o) => o.textContent?.includes('supas'))!)
    expect(screen.queryByText(/you say or type it yourself/)).not.toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0]).toMatchObject({ grade: Rating.Good, kind: 'recall-choose' })
  })

  it('switches from typing to options and remembers the choice', () => {
    renderExercise()
    fireEvent.click(screen.getByRole('tab', { name: 'Options' }))
    expect(useSettings.getState().recallAnswer).toBe('choose')
    expect(within(screen.getByRole('group')).getAllByRole('button')).toHaveLength(4)
  })

  it('switches to saying the word aloud and remembers the choice', () => {
    const onDone = renderExercise()
    fireEvent.click(screen.getByRole('tab', { name: 'Say' }))
    expect(useSettings.getState().recallAnswer).toBe('say')
    expect(screen.getByText('Say it out loud in Sorani')).toBeInTheDocument()
    fireEvent.click(button('Show answer'))
    fireEvent.click(button('Good'))
    expect(onDone.mock.calls[0][0]).toMatchObject({ kind: 'recall-spoken' })
  })

  it('asks aloud straight away for learners who prefer saying', () => {
    useSettings.setState({ recallAnswer: 'say' })
    renderExercise()
    expect(screen.getByText('Say it out loud in Sorani')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Say' })).toHaveAttribute('aria-selected', 'true')
  })
})
