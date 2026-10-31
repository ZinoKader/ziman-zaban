import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markup } from './markup'
import { parseMarkup, splitScript, stripMarkup, teaser } from './markup-parse'

describe('parseMarkup', () => {
  it('splits paragraphs on blank lines and joins soft line breaks', () => {
    expect(parseMarkup('One\ntwo.\n\n  \nThree.')).toEqual([[{ kind: 'text', text: 'One two.' }], [{ kind: 'text', text: 'Three.' }]])
  })

  it('parses bold and code', () => {
    expect(parseMarkup('An **ending** like `-im` on `باش`.')).toEqual([
      [
        { kind: 'text', text: 'An ' },
        { kind: 'bold', text: 'ending' },
        { kind: 'text', text: ' like ' },
        { kind: 'code', text: '-im' },
        { kind: 'text', text: ' on ' },
        { kind: 'code', text: 'باش' },
        { kind: 'text', text: '.' },
      ],
    ])
  })

  it('leaves unbalanced markers as text', () => {
    expect(parseMarkup('a ** b ` c')).toEqual([[{ kind: 'text', text: 'a ** b ` c' }]])
  })

  it('returns nothing for empty input', () => {
    expect(parseMarkup('')).toEqual([])
    expect(parseMarkup('\n\n')).toEqual([])
  })
})

describe('stripMarkup and teaser', () => {
  it('removes markers', () => {
    expect(stripMarkup('**Bold** and `code`.\n\nNext.')).toBe('Bold and code. Next.')
  })

  it('takes the first sentence', () => {
    expect(teaser('First **one**. Second one.')).toBe('First one.')
  })

  it('shortens long sentences on a word boundary', () => {
    const t = teaser(`${'word '.repeat(40)}end.`, 50)
    expect(t.length).toBeLessThanOrEqual(51)
    expect(t.endsWith('word…')).toBe(true)
  })
})

describe('splitScript', () => {
  it('keeps multi-word Arabic-script phrases in one run', () => {
    expect(splitScript('say من سویدیم، ئەو کوردە here')).toEqual([
      { script: false, text: 'say ' },
      { script: true, text: 'من سویدیم، ئەو کوردە' },
      { script: false, text: ' here' },
    ])
  })
})

describe('Markup', () => {
  it('renders paragraphs, bold and code as elements with RTL script', () => {
    const { container } = render(<Markup source={'Say **من** `min`.\n\nThen `باشم`.'} lang="ckb" />)
    const ps = container.querySelectorAll('p')
    expect(ps).toHaveLength(2)
    const bold = container.querySelector('strong')!
    expect(bold.textContent).toBe('من')
    expect(bold.querySelector('bdi')).toHaveAttribute('lang', 'ckb')
    expect(container.querySelector('code')).toHaveTextContent('min')
    const scriptCode = [...container.querySelectorAll('bdi')].find((b) => b.textContent === 'باشم')!
    expect(scriptCode).toHaveAttribute('dir', 'rtl')
  })

  it('never interprets HTML', () => {
    const { container } = render(<Markup source={'<img src=x onerror="alert(1)"> **<b>x</b>**'} lang="fa" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  })
})
