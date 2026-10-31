import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import evidenceJson from '@/content/generated/evidence.json'
import { useSettings } from '@/store/settings'
import { AboutPage } from './about-page'
import { CITATIONS, PRINCIPLES } from './citations'
import { countEvidence, EVIDENCE_LEVELS, exampleIdAt } from './evidence-stats'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <AboutPage />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('countEvidence', () => {
  it('counts items per kind, language and level', () => {
    const counts = countEvidence({
      'concept:ckb:a': { level: 'strong' },
      'concept:ckb:b': { level: 'strong' },
      'concept:fa:a': { level: 'none' },
      'sentence:fa:s': { level: 'good' },
      'qa:ckb:q': { level: 'attested' },
      'concept:ckb:c': { level: 'bogus' },
      'other:ckb:x': { level: 'strong' },
    })
    expect(counts.concept.ckb).toMatchObject({ strong: 2, none: 0, total: 2 })
    expect(counts.concept.fa).toMatchObject({ none: 1, total: 1 })
    expect(counts.sentence.fa.good).toBe(1)
    expect(counts.qa.ckb.attested).toBe(1)
  })

  it('accounts for every item in the generated evidence file', () => {
    const counts = countEvidence()
    const total = (['concept', 'sentence', 'qa'] as const).reduce((n, k) => n + counts[k].ckb.total + counts[k].fa.total, 0)
    expect(total).toBe(Object.keys(evidenceJson).length)
    for (const level of EVIDENCE_LEVELS) {
      const id = exampleIdAt(level, 'ckb')
      if (id) expect((evidenceJson as Record<string, { level: string }>)[`concept:ckb:${id}`].level).toBe(level)
    }
  })
})

describe('citations', () => {
  it('every principle cites at least one complete reference', () => {
    expect(PRINCIPLES).toHaveLength(10)
    for (const p of PRINCIPLES) {
      expect(p.cites.length).toBeGreaterThan(0)
      for (const id of p.cites) {
        const c = CITATIONS[id]
        expect(c.authors && c.title && c.venue).toBeTruthy()
        expect(c.year).toBeGreaterThan(1990)
      }
    }
  })
})

describe('AboutPage', () => {
  it('renders the path, the research, live evidence counts and sources', () => {
    useSettings.setState({ baseLang: 'en', targetLang: 'ckb' })
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Method & sources' })).toBeInTheDocument()
    for (const name of ['Recognition', 'Recall', 'Sentence building', 'Questions & answers']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: 'Answer questions, don’t just repeat' })).toBeInTheDocument()
    expect(screen.getAllByText(/Muramoto, D\./).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Bibauw, S\./).length).toBeGreaterThan(0)

    const counts = countEvidence()
    const strongRow = screen.getByRole('row', { name: /Confirmed by two sources/ })
    expect(within(strongRow).getAllByText(String(counts.concept.ckb.strong)).length).toBeGreaterThan(0)

    expect(screen.getByText('License: CC BY-SA 4.0')).toBeInTheDocument()
    expect(screen.getByText('License: CC BY 2.0 FR')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open native review/ })).toHaveAttribute('href', '/review')
  })

  it('shows a live evidence badge that opens its details', () => {
    useSettings.setState({ baseLang: 'en', targetLang: 'fa' })
    renderPage()
    const id = exampleIdAt('strong', 'fa') ?? exampleIdAt('good', 'fa')
    if (!id) return
    const badges = screen.getAllByRole('button', { name: /Confirmed by/ })
    fireEvent.click(badges[0])
    expect(screen.getByText('How we checked this')).toBeInTheDocument()
  })

  it('renders in Swedish', () => {
    useSettings.setState({ baseLang: 'sv', targetLang: 'ckb' })
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Metod & källor' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ärliga begränsningar' })).toBeInTheDocument()
  })
})
