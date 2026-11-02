import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { HomePage } from '@/features/home/home-page'
import { useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { changelog, latestRelease } from './changelog'
import { WhatsNewPage } from './whats-new-page'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/whats-new" element={<WhatsNewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useSettings.setState({ baseLang: 'sv', targetLang: 'fa', onboarded: true, changelogSeen: null })
  useProgress.setState({ cards: {}, log: [], days: {}, daysByLang: {}, reports: [] })
})

describe('WhatsNewPage', () => {
  it('lists the Swedish changes for Swedish speakers and marks them as seen', () => {
    renderAt('/whats-new')
    expect(screen.getByRole('heading', { level: 1, name: 'Nytt i appen' })).toBeInTheDocument()
    const first = changelog.sv[0].changes[0]
    expect(screen.getAllByText(first.area!).length).toBeGreaterThan(0)
    expect(screen.getByText(first.text.charAt(0).toUpperCase() + first.text.slice(1))).toBeInTheDocument()
    expect(useSettings.getState().changelogSeen).toBe(latestRelease)
  })

  it('shows English changes for English speakers', () => {
    useSettings.setState({ baseLang: 'en' })
    renderAt('/whats-new')
    expect(screen.getByRole('heading', { level: 1, name: "What's new" })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(changelog.en.reduce((n, r) => n + r.changes.length, 0))
  })
})

describe('WhatsNewBanner on the home page', () => {
  it('shows unseen changes and goes away once hidden', () => {
    renderAt('/')
    const total = changelog.en.reduce((n, r) => n + r.changes.length, 0)
    expect(screen.getByText(`Nytt i appen: ${total} ändringar`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dölj' }))
    expect(screen.queryByText(/Nytt i appen:/)).not.toBeInTheDocument()
    expect(useSettings.getState().changelogSeen).toBe(latestRelease)
  })

  it('stays hidden once the newest entry has been seen', () => {
    useSettings.setState({ changelogSeen: latestRelease })
    renderAt('/')
    expect(screen.queryByText(/Nytt i appen:/)).not.toBeInTheDocument()
  })
})
