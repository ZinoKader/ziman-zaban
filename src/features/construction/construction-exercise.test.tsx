import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { sentencesFor } from '@/content'
import type { Sentence, TargetLang } from '@/content/types'
import type { Candidate } from '@/lib/curriculum'
import { cardKey, newCard, Rating, State, type StoredCard } from '@/lib/srs'
import { useSettings } from '@/store/settings'
import { ConstructionExercise } from './construction-exercise'
import { pickClozeIndex, stripPunct } from './logic'
import { seededRandom } from '@/lib/distractors'

function sentence(lang: TargetLang, id: string): Sentence {
  const s = sentencesFor(lang).find((x) => x.id === id)
  if (!s) throw new Error(`missing ${lang}:${id}`)
  return s
}

function card(stability: number): StoredCard {
  return { ...newCard(new Date()), stability, state: State.Review, reps: 3 }
}

function setup(lang: TargetLang, s: Sentence, opts: { card?: StoredCard; attempt?: number } = {}) {
  const onDone = vi.fn()
  const item: Candidate = {
    key: cardKey(lang, 'construction', s.id),
    itemId: s.id,
    isNew: !opts.card,
    order: 0,
    card: opts.card,
  }
  render(
    <MemoryRouter>
      <TooltipProvider>
        <ConstructionExercise item={item} lang={lang} attempt={opts.attempt ?? 0} onDone={onDone} />
      </TooltipProvider>
    </MemoryRouter>,
  )
  return { onDone, item }
}

const add = (text: string) => fireEvent.click(screen.getByRole('button', { name: `Add ${stripPunct(text)}` }))
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check' }))
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

describe('ConstructionExercise', () => {
  it('introduces a new Sorani sentence with a word-by-word gloss, then has it built from tiles', () => {
    const s = sentence('ckb', 'i-am-sara')
    const { onDone } = setup('ckb', s)
    expect(screen.getByText('New sentence')).toBeInTheDocument()
    expect(screen.getByText(s.translation.en)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Word by word' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Word by word' })).toHaveTextContent('Sara-COP.1SG')
    expect(screen.getByTitle('1st person singular')).toBeInTheDocument()
    expect(screen.getByText(/copula, “to be”/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /build it/ }))
    expect(screen.getByRole('group', { name: 'Word bank' })).toBeInTheDocument()
    for (const t of s.ckb!.tokens) add(t.text)
    check()
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.queryByText('Listen and repeat aloud')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More about this sentence' }))
    expect(screen.getByText('Listen and repeat aloud')).toBeInTheDocument()
    next()
    // Never Easy right after seeing the model sentence.
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ grade: Rating.Good, kind: 'construction-intro' }))
  })

  it('builds a Persian sentence from the word bank and shows the spoken version', () => {
    const s = sentence('fa', 'i-am-sara')
    const { onDone } = setup('fa', s, { card: card(1) })
    expect(screen.getByText('Build this sentence in Persian')).toBeInTheDocument()
    for (const t of s.fa!.tokens) add(t.text)
    check()
    expect(screen.getByText('Spoken')).toBeInTheDocument()
    expect(screen.getByText(s.fa!.colloquial!.text)).toBeInTheDocument()
    next()
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ grade: Rating.Easy, kind: 'construction-bank' }))
  })

  it('grades a distractor as Again and highlights it', () => {
    const s = sentence('ckb', 'i-am-sara')
    const { onDone } = setup('ckb', s, { card: card(1) })
    add('من')
    add(s.ckb!.distractors![0].text)
    check()
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(document.querySelector('[data-state="wrong"]')).not.toBeNull()
    next()
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ grade: Rating.Again }))
  })

  it('grades one swapped pair in a longer sentence as Hard, never Easy on a retry', () => {
    const s = sentence('fa', 'my-name-is-sara')
    const { onDone } = setup('fa', s, { card: card(1), attempt: 1 })
    const [a, b, ...rest] = s.fa!.tokens.map((t) => t.text)
    for (const t of [b, a, ...rest]) add(t)
    check()
    expect(screen.getByText('One word is off; the rest is right.')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-state="misplaced"]').length).toBeGreaterThan(0)
    next()
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ grade: Rating.Hard }))
  })

  it('supports number keys, Backspace and Enter in the word bank', () => {
    const s = sentence('ckb', 'who-is-that-man')
    const { onDone } = setup('ckb', s, { card: card(1) })
    const bank = screen.getByRole('group', { name: 'Word bank' })
    const labels = [...bank.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))
    const keyFor = (text: string) => String((labels.indexOf(`Add ${stripPunct(text)}`) + 1) % 10)
    fireEvent.keyDown(window, { key: keyFor(s.ckb!.distractors![0].text) })
    fireEvent.keyDown(window, { key: 'Backspace' })
    for (const t of s.ckb!.tokens) fireEvent.keyDown(window, { key: keyFor(t.text) })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    next()
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ grade: Rating.Easy }))
  })

  it('removes a placed tile when tapped', () => {
    const s = sentence('ckb', 'i-am-sara')
    setup('ckb', s, { card: card(1) })
    add('من')
    fireEvent.click(screen.getByRole('button', { name: 'Remove من' }))
    expect(screen.queryByRole('button', { name: 'Remove من' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add من' })).toBeInTheDocument()
  })

  it('asks for the missing word in cloze mode once the card is established', () => {
    const s = sentence('ckb', 'i-am-sara')
    const { onDone, item } = setup('ckb', s, { card: card(5) })
    expect(screen.getByText('Fill in the missing word')).toBeInTheDocument()
    const blank = s.ckb!.tokens[pickClozeIndex(s.ckb!.tokens, seededRandom(`${item.key}:0:cloze`))]
    fireEvent.change(screen.getByRole('textbox'), { target: { value: stripPunct(blank.latin) } })
    check()
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    next()
    expect(onDone.mock.calls[0][0].grade).toBeGreaterThanOrEqual(Rating.Good)
    expect(onDone.mock.calls[0][0].kind).toBe('construction-cloze')
  })

  it('asks for the whole sentence once mature, with a word diff on errors', () => {
    const s = sentence('fa', 'i-am-sara')
    const { onDone } = setup('fa', s, { card: card(20) })
    expect(screen.getByText('Say it in Persian')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'تو کجا هستی' } })
    check()
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByText('Your answer:')).toBeInTheDocument()
    next()
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ grade: Rating.Again, kind: 'construction-typed' }))
  })

  it('accepts the typed sentence in Latin letters', () => {
    const s = sentence('ckb', 'who-is-that-man')
    const { onDone } = setup('ckb', s, { card: card(20) })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: s.ckb!.latin } })
    check()
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    next()
    expect(onDone.mock.calls[0][0].grade).toBeGreaterThanOrEqual(Rating.Good)
  })

  it('uses Swedish strings and hides romanization on tiles when set to never', () => {
    useSettings.setState({ baseLang: 'sv', romanization: 'never' })
    const s = sentence('ckb', 'i-am-sara')
    setup('ckb', s, { card: card(1) })
    expect(screen.getByText('Bygg meningen på sorani')).toBeInTheDocument()
    expect(screen.getByText(s.translation.sv)).toBeInTheDocument()
    expect(screen.queryByText('min')).toBeNull()
    useSettings.setState({ baseLang: 'en', romanization: 'always' })
  })

  it('renders every real sentence in both languages without crashing', () => {
    for (const lang of ['ckb', 'fa'] as const) {
      for (const s of sentencesFor(lang)) {
        const { unmount } = render(
          <MemoryRouter>
            <TooltipProvider>
              <ConstructionExercise
                item={{ key: cardKey(lang, 'construction', s.id), itemId: s.id, isNew: true, order: 0 }}
                lang={lang}
                attempt={0}
                onDone={() => {}}
              />
            </TooltipProvider>
          </MemoryRouter>,
        )
        expect(screen.getAllByText(s.translation.en).length).toBeGreaterThan(0)
        unmount()
      }
    }
  }, 20_000)
})
