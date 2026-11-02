import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { conceptsFor } from '@/content'
import { cardKey, Rating, reviewCard } from '@/lib/srs'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { ModulePage } from './module-page'

const words = conceptsFor('fa')

function renderModule(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/learn/${slug}`]}>
      <Routes>
        <Route path="/learn/:module" element={<ModulePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const value = (label: string) => screen.getByText(label).parentElement?.querySelector('dd')?.textContent

beforeEach(() => {
  useSettings.setState({ baseLang: 'sv', targetLang: 'fa', onboarded: true })
  useProgress.setState({ cards: {}, log: [], days: {}, daysByLang: {}, reports: [] })
})

describe('ModulePage', () => {
  it('explains how reviews work and what happens after the last word, before anything is started', () => {
    renderModule('recognition')
    expect(screen.getByText('Att repetera nu')).toBeInTheDocument()
    expect(screen.getByText('Så fungerar repetitionerna')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`^Vad händer efter alla ${words.length} ord\\?`))).toBeInTheDocument()
    expect(screen.queryByText('Kommer tillbaka')).not.toBeInTheDocument()
  })

  it("shows when this module's words come back", () => {
    const now = new Date()
    const learning = reviewCard(undefined, Rating.Good, now)
    const learned = reviewCard(undefined, Rating.Easy, now)
    useProgress.setState({
      cards: {
        [cardKey('fa', 'recognition', words[0].id)]: learning,
        [cardKey('fa', 'recognition', words[1].id)]: learned,
        [cardKey('fa', 'recall', words[2].id)]: learning,
      },
    })
    renderModule('recognition')
    expect(screen.getByText('Kommer tillbaka')).toBeInTheDocument()
    const soon = Number(value('Senare idag')) + Number(value('Imorgon'))
    const total = soon + Number(value('I veckan')) + Number(value('Senare'))
    expect(total).toBe(2)
  })
})
