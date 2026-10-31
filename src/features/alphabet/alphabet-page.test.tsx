import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSettings } from '@/store/settings'
import { AlphabetPage } from './alphabet-page'

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
        <AlphabetPage />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

const letterTiles = () => [...screen.queryAllByRole('button', { pressed: false }), ...screen.queryAllByRole('button', { pressed: true })]

describe('AlphabetPage', () => {
  it('shows the Sorani letters by default and switches to Persian', () => {
    useSettings.setState({ targetLang: 'ckb', baseLang: 'en' })
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Reading the script' })).toBeInTheDocument()
    expect(letterTiles()).toHaveLength(34)

    fireEvent.click(screen.getByRole('radio', { name: /Persian/ }))
    expect(letterTiles()).toHaveLength(33)
    expect(screen.getByRole('heading', { name: 'Letters from Arabic' })).toBeInTheDocument()
  })

  it('filters the grid and opens a letter with its shapes and example word', () => {
    useSettings.setState({ targetLang: 'ckb', baseLang: 'en' })
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: "Don't join" }))
    expect(letterTiles()).toHaveLength(10)

    fireEvent.click(screen.getByRole('button', { name: /^ژ, jê, j$/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('s as in measure')).toBeInTheDocument()
    expect(within(dialog).getByText('Alone')).toBeInTheDocument()
    expect(within(dialog).queryByText('Middle')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Open in Words/ })).toHaveAttribute('href', expect.stringMatching(/^\/words\//))
  })

  it('renders in Swedish', () => {
    useSettings.setState({ targetLang: 'fa', baseLang: 'sv' })
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Att läsa skriften' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Så skrivs vokalerna' })).toBeInTheDocument()
  })

  it('runs a quiz round', () => {
    useSettings.setState({ targetLang: 'fa', baseLang: 'en' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Start the quiz' }))
    expect(screen.getByText('1 of 8')).toBeInTheDocument()
    const options = within(screen.getByRole('group', { name: 'What sound does this letter make?' })).getAllByRole('button')
    expect(options).toHaveLength(4)
    for (const o of options) fireEvent.click(o)
    expect(options.every((o) => (o as HTMLButtonElement).disabled)).toBe(true)
  })
})
