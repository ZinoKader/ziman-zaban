import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSettings } from '@/store/settings'
import { GrammarPage } from './grammar-page'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/grammar" element={<GrammarPage />} />
          <Route path="/grammar/:pointId" element={<GrammarPage />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useSettings.setState({ baseLang: 'en', targetLang: 'ckb', compare: true, romanization: 'always', autoplayAudio: false })
})

describe('GrammarPage list', () => {
  it('groups Sorani grammar by unit in curriculum order', () => {
    renderAt('/grammar')
    expect(screen.getByRole('heading', { level: 1, name: 'Grammar' })).toBeInTheDocument()
    const sections = screen.getAllByRole('region')
    const names = sections.map((s) => s.getAttribute('aria-labelledby'))
    expect(names.indexOf('grammar-unit-me-and-you')).toBeLessThan(names.indexOf('grammar-unit-family'))
    const meAndYou = screen.getByRole('region', { name: /Me and you/ })
    expect(within(meAndYou).getByRole('link', { name: /Personal pronouns/ })).toHaveAttribute('href', '/grammar/ckb-pronouns')
    expect(within(meAndYou).getAllByText('A1').length).toBeGreaterThan(0)
  })

  it('lists Persian points in Swedish', () => {
    useSettings.setState({ baseLang: 'sv', targetLang: 'fa' })
    renderAt('/grammar')
    expect(screen.getByRole('heading', { level: 1, name: 'Grammatik' })).toBeInTheDocument()
    expect(screen.queryAllByRole('link').every((a) => a.getAttribute('href')?.startsWith('/grammar/fa-'))).toBe(true)
  })
})

describe('GrammarPage detail', () => {
  it('shows explanation, examples with glosses, course sentences, sources and navigation', () => {
    renderAt('/grammar/ckb-copula')
    const article = screen.getByRole('article')
    expect(within(article).getByRole('heading', { level: 1, name: 'To be: the copula endings' })).toBeInTheDocument()
    expect(within(article).getAllByText('ending').length).toBeGreaterThan(0)

    expect(within(article).getByRole('heading', { name: 'Examples' })).toBeInTheDocument()
    expect(within(article).getAllByText('Where are you?').length).toBeGreaterThan(0)
    expect(within(article).getAllByTitle('copula (to be)').length).toBeGreaterThan(0)
    expect(within(article).getAllByTitle('1st person singular').length).toBeGreaterThan(0)

    expect(within(article).getByRole('heading', { name: 'In the course' })).toBeInTheDocument()
    expect(within(article).getByText(/Thackston.*§15/)).toBeInTheDocument()
    expect(within(article).getByText(/Kim.*chapter “Linking verbs”/)).toBeInTheDocument()

    expect(within(article).getByRole('link', { name: /Previous.*Personal pronouns/ })).toHaveAttribute('href', '/grammar/ckb-pronouns')
    expect(within(article).getByRole('link', { name: /How Persian does it/ })).toHaveAttribute('href', '/grammar/fa-copula')
  })

  it('hides the counterpart link when compare is off', () => {
    useSettings.setState({ compare: false })
    renderAt('/grammar/ckb-copula')
    expect(screen.queryByRole('link', { name: /How Persian does it/ })).not.toBeInTheDocument()
  })

  it('navigates with the arrow keys', () => {
    renderAt('/grammar/ckb-copula')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByRole('heading', { level: 1, name: 'Personal pronouns' })).toBeInTheDocument()
  })

  it('handles an unknown point', () => {
    renderAt('/grammar/nope')
    expect(screen.getByText('This grammar point does not exist (any more).')).toBeInTheDocument()
  })
})
