import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSettings, type RomanizationMode } from '@/store/settings'
import { TargetText, type TargetTextProps } from './target-text'

function renderText(props: Partial<TargetTextProps> = {}) {
  return render(
    <TooltipProvider>
      <TargetText lang="ckb" text="سوپاس" latin="supas" audio {...props} />
    </TooltipProvider>,
  )
}

const roleOf = (text: string) => screen.getByText(text).getAttribute('data-role')

/** The text of the leading and the secondary line, in document order. */
function lines(container: HTMLElement) {
  return [...container.querySelectorAll('[data-role]')].map((el) => `${el.getAttribute('data-role')}:${el.textContent}`)
}

const setMode = (romanization: RomanizationMode) => useSettings.setState({ romanization })

beforeEach(() => setMode('always'))

describe('TargetText', () => {
  it('always: the romanization leads and the script sits under it, right to left', () => {
    const { container } = renderText()
    expect(lines(container)).toEqual(['primary:supas', 'secondary:سوپاس'])
    const script = screen.getByText('سوپاس')
    expect(script).toHaveAttribute('dir', 'rtl')
    expect(script).toHaveAttribute('lang', 'ckb')
    expect(script).toHaveClass('font-script')
    expect(screen.getByText('supas')).toHaveClass('font-bold')
  })

  it('keeps the audio button on the leading line', () => {
    renderText()
    const line = screen.getByRole('button', { name: /pronunciation|voice/i }).closest('div')
    expect(line).toContainElement(screen.getByText('supas'))
    expect(line).not.toContainElement(screen.getByText('سوپاس'))
  })

  it('never: only the script, as the leading line', () => {
    setMode('never')
    const { container } = renderText()
    expect(lines(container)).toEqual(['primary:سوپاس'])
  })

  it('never, with romanization forced on: the script still leads', () => {
    setMode('never')
    const { container } = renderText({ romanization: 'always' })
    expect(lines(container)).toEqual(['primary:سوپاس', 'secondary:supas'])
  })

  it('tap: the script leads until tapped, then the romanization takes over', () => {
    setMode('tap')
    const { container } = renderText()
    expect(lines(container)).toEqual(['primary:سوپاس'])
    fireEvent.click(screen.getByRole('button', { name: 'Tap to show pronunciation' }))
    expect(lines(container)).toEqual(['primary:supas', 'secondary:سوپاس'])
    expect(screen.queryByRole('button', { name: 'Tap to show pronunciation' })).not.toBeInTheDocument()
  })

  it('lead="script" keeps the script primary, for reviewers judging spelling', () => {
    renderText({ lead: 'script' })
    expect(roleOf('سوپاس')).toBe('primary')
    expect(roleOf('supas')).toBe('secondary')
  })

  it('without romanization the script leads whatever the setting', () => {
    const { container } = renderText({ latin: undefined })
    expect(lines(container)).toEqual(['primary:سوپاس'])
  })
})
