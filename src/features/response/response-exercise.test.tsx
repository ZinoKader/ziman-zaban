import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { qaFor } from '@/content'
import type { TargetLang } from '@/content/types'
import { speak, useVoice } from '@/lib/audio'
import type { Candidate } from '@/lib/curriculum'
import { newCard, Rating, type StoredCard } from '@/lib/srs'
import { useSettings } from '@/store/settings'
import type { ExerciseResult } from '../session/types'
import { usePersonal } from './personal-store'
import { ResponseExercise } from './response-exercise'
import { isTemplate } from './template'

vi.mock('@/lib/audio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audio')>()
  return { ...actual, speak: vi.fn(async () => true), useVoice: vi.fn(() => undefined) }
})

const ckbName = qaFor('ckb').find((q) => q.id === 'what-is-your-name')!
const faName = qaFor('fa').find((q) => q.id === 'what-is-your-name')!

const card = (patch: Partial<StoredCard>): StoredCard => ({ ...newCard(new Date()), ...patch })
const FREE = card({ reps: 5, stability: 12 })
const BUILD = card({ reps: 3, stability: 2 })

function candidate(lang: TargetLang, itemId: string, stored?: StoredCard): Candidate {
  return { key: `${lang}:response:${itemId}`, itemId, isNew: !stored, order: 0, card: stored }
}

function renderExercise(lang: TargetLang, item: Candidate, attempt = 0) {
  const onDone = vi.fn<(r: ExerciseResult) => void>()
  render(
    <TooltipProvider>
      <ResponseExercise item={item} lang={lang} attempt={attempt} onDone={onDone} />
    </TooltipProvider>,
  )
  return onDone
}

const button = (name: RegExp | string) => screen.getByRole('button', { name })

function optionButtons() {
  return within(screen.getByRole('group', { name: 'Which answer fits?' })).getAllByRole('button')
}

function correctIndex(answers: string[]) {
  return optionButtons().findIndex((b) => answers.some((a) => b.textContent?.includes(a)))
}

beforeEach(() => {
  useSettings.setState({ baseLang: 'en', romanization: 'always', answerScript: 'latin', autoplayAudio: true })
  usePersonal.setState({ values: {} })
  vi.mocked(speak).mockClear()
  vi.mocked(useVoice).mockReturnValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ResponseExercise: choosing (new items)', () => {
  it('renders a real Sorani item as a chat question with options, text shown when there is no voice', async () => {
    renderExercise('ckb', candidate('ckb', ckbName.id))
    const word = await screen.findByRole('button', { name: 'nawit' })
    expect(word.closest('p')).toHaveTextContent('nawit çîye?')
    expect(screen.getByText('ناوت چییە؟')).toHaveAttribute('dir', 'rtl')
    expect(screen.getByText('Shilan asks')).toBeInTheDocument()
    expect(screen.getByText(/no voice for this language/)).toBeInTheDocument()
    expect(screen.queryByText('What is your name?')).not.toBeInTheDocument()
    expect(optionButtons()).toHaveLength(4)
    expect(speak).not.toHaveBeenCalled()
  })

  it('grades a correct choice Good at most', async () => {
    const onDone = renderExercise('ckb', candidate('ckb', ckbName.id))
    await screen.findByRole('button', { name: 'nawit' })
    const answers = ckbName.ckb!.answers.filter((a) => !isTemplate(a)).map((a) => a.text)
    fireEvent.click(optionButtons()[correctIndex(answers)])
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText('What is your name?')).toBeInTheDocument()
    expect(screen.queryByText('Ways to answer')).not.toBeInTheDocument()
    fireEvent.click(button(/More ways to answer/))
    expect(screen.getByText('Ways to answer')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onDone.mock.calls[0][0]).toMatchObject({ grade: Rating.Good, kind: 'response-choose' })
  })

  it('answers with number keys; a wrong choice is Again', async () => {
    const onDone = renderExercise('fa', candidate('fa', faName.id))
    await screen.findByRole('button', { name: 'esm-e' })
    const answers = faName.fa!.answers.filter((a) => !isTemplate(a)).map((a) => a.text)
    const wrong = optionButtons().findIndex((_, i) => i !== correctIndex(answers))
    fireEvent.keyDown(window, { key: String(wrong + 1) })
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBe(Rating.Again)
  })

  it('caps the grade at Hard when the translation was shown', async () => {
    const onDone = renderExercise('ckb', candidate('ckb', ckbName.id))
    await screen.findByRole('button', { name: 'nawit' })
    fireEvent.click(button('Show translation'))
    expect(screen.getByText('What is your name?')).toBeInTheDocument()
    const answers = ckbName.ckb!.answers.filter((a) => !isTemplate(a)).map((a) => a.text)
    fireEvent.click(optionButtons()[correctIndex(answers)])
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBe(Rating.Hard)
  })

  it('shows the gloss of a tapped word', async () => {
    renderExercise('ckb', candidate('ckb', ckbName.id))
    fireEvent.click(await screen.findByRole('button', { name: 'nawit' }))
    expect(await screen.findByText('your name')).toBeInTheDocument()
    expect(screen.getByText('name-2SG')).toBeInTheDocument()
  })
})

describe('ResponseExercise: audio first', () => {
  it('auto-plays the question and hides the text in free mode until asked', async () => {
    vi.mocked(useVoice).mockReturnValue({ lang: 'fa-IR', name: 'Dariush' } as SpeechSynthesisVoice)
    renderExercise('fa', candidate('fa', faName.id, FREE))
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ lang: 'fa', text: faName.fa!.question.text }))
    expect(screen.queryByRole('button', { name: 'esm-e' })).not.toBeInTheDocument()
    expect(button('Play the question')).toBeInTheDocument()
    fireEvent.click(button('Show text'))
    expect(screen.getByRole('button', { name: 'esm-e' })).toBeInTheDocument()
  })

  it('fades the text in after listening when choosing', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(useVoice).mockReturnValue({ lang: 'fa-IR', name: 'Dariush' } as SpeechSynthesisVoice)
      renderExercise('fa', candidate('fa', faName.id))
      expect(screen.queryByRole('button', { name: 'esm-e' })).not.toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1300))
      expect(screen.getByRole('button', { name: 'esm-e' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('ResponseExercise: building', () => {
  it('builds the Persian model answer from tiles', async () => {
    const onDone = renderExercise('fa', candidate('fa', faName.id, BUILD))
    expect(screen.getByText('Build your answer')).toBeInTheDocument()
    for (const w of ['اسم', 'من', 'آرش', 'است']) fireEvent.click(button(`Add ${w}`))
    fireEvent.click(button('Check'))
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].kind).toBe('response-build')
    expect(onDone.mock.calls[0][0].grade).toBeGreaterThanOrEqual(Rating.Good)
  })

  it('marks a wrong word order as wrong; Backspace removes the last tile', async () => {
    const onDone = renderExercise('fa', candidate('fa', faName.id, BUILD))
    for (const w of ['من', 'اسم', 'آرش', 'است', 'آرش']) {
      const b = screen.queryByRole('button', { name: `Add ${w}` })
      if (b && !(b as HTMLButtonElement).disabled) fireEvent.click(b)
    }
    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(screen.queryByRole('button', { name: 'Remove است' })).not.toBeInTheDocument()
    fireEvent.click(button('Add است'))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBe(Rating.Again)
  })
})

describe('ResponseExercise: free answer', () => {
  it('accepts a typed Persian answer that fills the template slot, and lets the learner make it theirs', async () => {
    const onDone = renderExercise('fa', candidate('fa', faName.id, FREE))
    expect(screen.getByText('Answer in Persian')).toBeInTheDocument()
    const input = screen.getByPlaceholderText(/Type your answer/)
    fireEvent.change(input, { target: { value: 'اسمم نیلوفره' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    fireEvent.click(button('More ways to answer, or make it yours'))
    expect(screen.getByText('Matches your answer')).toBeInTheDocument()

    expect(screen.getByText('Make it yours')).toBeInTheDocument()
    expect(screen.getByLabelText('In Arabic script')).toHaveValue('نیلوفر')
    fireEvent.change(screen.getByLabelText('In Arabic script'), { target: { value: 'اریک' } })
    fireEvent.change(screen.getByLabelText('In Latin letters'), { target: { value: 'Erik' } })
    fireEvent.click(button('Save'))
    expect(usePersonal.getState().values['fa:what-is-your-name:name']).toEqual({ text: 'اریک', latin: 'Erik' })
    expect(screen.getByText('Your version')).toBeInTheDocument()
    expect(screen.getAllByText('{name} hastam.'.replace('{name}', 'Erik')).length).toBeGreaterThan(0)

    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0]).toMatchObject({ kind: 'response-typed' })
    expect(onDone.mock.calls[0][0].grade).toBeGreaterThanOrEqual(Rating.Good)
  })

  it('fills model answers with the saved personal value', () => {
    usePersonal.setState({ values: { 'ckb:what-is-your-name:name': { text: 'ئێریک', latin: 'Êrîk' } } })
    renderExercise('ckb', candidate('ckb', ckbName.id, FREE))
    fireEvent.click(button("I don't know"))
    expect(screen.getAllByText('ناوم ئێریکە.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('My name is Êrîk.').length).toBeGreaterThan(0)
  })

  it('accepts a typed Sorani answer in Latin letters', () => {
    const onDone = renderExercise('ckb', candidate('ckb', ckbName.id, FREE))
    const input = screen.getByPlaceholderText(/Type your answer/)
    fireEvent.change(input, { target: { value: 'nawim Shilane' } })
    fireEvent.click(button('Check'))
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBeGreaterThanOrEqual(Rating.Good)
  })

  it('rejects an answer to a different question', () => {
    const onDone = renderExercise('ckb', candidate('ckb', ckbName.id, FREE))
    const input = screen.getByPlaceholderText(/Type your answer/)
    fireEvent.change(input, { target: { value: 'خەڵکی سویدم' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    fireEvent.click(button('Continue'))
    expect(onDone.mock.calls[0][0].grade).toBe(Rating.Again)
  })

  it('steps down to building when a free item comes back after a miss', () => {
    renderExercise('ckb', candidate('ckb', ckbName.id, FREE), 1)
    expect(screen.getByText('Build your answer')).toBeInTheDocument()
  })

  it('lets the learner say the answer aloud and grade themselves when recording is unavailable', () => {
    const onDone = renderExercise('ckb', candidate('ckb', ckbName.id, FREE))
    fireEvent.click(screen.getByRole('tab', { name: 'Speak' }))
    expect(screen.getByText('Say your answer aloud')).toBeInTheDocument()
    fireEvent.click(button("I've said it"))
    expect(screen.getByText('Compare with the model answer')).toBeInTheDocument()
    fireEvent.click(button('Easy'))
    expect(onDone.mock.calls[0][0]).toMatchObject({ grade: Rating.Easy, kind: 'response-said' })
  })

  it('records with MediaRecorder and plays it back next to the model answer', async () => {
    const stopTrack = vi.fn()
    class FakeRecorder {
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((e: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) })
        this.onstop?.()
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) },
    })
    URL.createObjectURL = vi.fn(() => 'blob:answer')
    URL.revokeObjectURL = vi.fn()

    const onDone = renderExercise('fa', candidate('fa', faName.id, FREE))
    fireEvent.click(screen.getByRole('tab', { name: 'Speak' }))
    fireEvent.click(button('Record your answer'))
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }))
    expect(await screen.findByText('Compare with the model answer')).toBeInTheDocument()
    expect(stopTrack).toHaveBeenCalled()
    expect(document.querySelector('audio')?.getAttribute('src')).toBe('blob:answer')
    fireEvent.click(button('Good'))
    expect(onDone.mock.calls[0][0]).toMatchObject({ grade: Rating.Good, kind: 'response-spoken' })
  })
})
