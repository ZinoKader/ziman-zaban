import { describe, expect, it } from 'vitest'
import { PERSIAN_LETTERS, SORANI_LETTERS, type Letter } from './letters'
import { makeQuiz } from './quiz'
import { contextualForms } from './script'
import guide from '../../../docs/CONTENT_GUIDE.md?raw'

const ZWJ = '\u200D'
const chars = (letters: Letter[]) => letters.map((x) => x.char)
const byChar = (letters: Letter[], ch: string) => letters.find((x) => x.char === ch)!

describe('letter data', () => {
  it('has the full Sorani alphabet plus the وو digraph', () => {
    const expected = 'ئ ا ب پ ت ج چ ح خ د ر ڕ ز ژ س ش ع غ ف ڤ ق ک گ ل ڵ م ن و ۆ ه ە ی ێ'.split(' ')
    expect(expected).toHaveLength(33)
    expect(chars(SORANI_LETTERS)).toEqual([...expected, 'وو'])
  })

  it('has the 32 Persian letters plus آ', () => {
    const expected = 'ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ه ی'.split(' ')
    expect(expected).toHaveLength(32)
    expect(chars(PERSIAN_LETTERS).filter((c: string) => c !== 'آ')).toEqual(expected)
    expect(chars(PERSIAN_LETTERS)).toContain('آ')
  })

  it('uses Kurdish/Iranian code points, never the Arabic look-alikes', () => {
    for (const x of [...SORANI_LETTERS, ...PERSIAN_LETTERS]) {
      expect(x.char).not.toMatch(/[يكىةھ]/)
      expect(x.char.normalize('NFC')).toBe(x.char)
    }
  })

  it('marks exactly the non-joining letters', () => {
    const nonJoining = (letters: Letter[]) => chars(letters.filter((x) => !x.joinsLeft)).sort()
    expect(nonJoining(SORANI_LETTERS)).toEqual(['ا', 'د', 'ر', 'ڕ', 'ز', 'ژ', 'و', 'ۆ', 'ە', 'وو'].sort())
    expect(nonJoining(PERSIAN_LETTERS)).toEqual(['ا', 'آ', 'د', 'ذ', 'ر', 'ز', 'ژ', 'و'].sort())
  })

  it('marks the Sorani vowel letters', () => {
    const vowels = chars(SORANI_LETTERS.filter((x) => x.role === 'vowel')).sort()
    expect(vowels).toEqual(['ا', 'ە', 'ێ', 'ۆ', 'وو'].sort())
    expect(byChar(SORANI_LETTERS, 'و').role).toBe('both')
    expect(byChar(SORANI_LETTERS, 'ی').role).toBe('both')
    expect(byChar(SORANI_LETTERS, 'ئ').role).toBe('seat')
    expect(byChar(SORANI_LETTERS, 'ه').role).toBe('consonant')
  })

  it('flags the Persian letters found mainly in Arabic loanwords', () => {
    expect(chars(PERSIAN_LETTERS.filter((x) => x.arabic)).sort()).toEqual(['ث', 'ح', 'ذ', 'ص', 'ض', 'ط', 'ظ', 'ع'].sort())
  })

  it('has an IPA value per romanization, a name and en+sv hints', () => {
    for (const x of [...SORANI_LETTERS, ...PERSIAN_LETTERS]) {
      expect(x.ipa.length).toBe(Math.max(1, x.latin.length))
      expect(x.name).toBeTruthy()
      expect(x.hint.en).toBeTruthy()
      expect(x.hint.sv).toBeTruthy()
      if (x.note) expect(x.note.sv).toBeTruthy()
    }
    expect(byChar(SORANI_LETTERS, 'ئ').latin).toEqual([])
  })
})

describe('romanization matches docs/CONTENT_GUIDE.md', () => {
  it('Sorani: every pair in the Hawar table', () => {
    const section = guide.split('### Sorani: Hawar-style Kurdish Latin')[1].split('###')[0]
    const pairs: Array<[string, string]> = []
    for (const line of section.split('\n')) {
      if (!line.startsWith('|') || line.includes('---') || line.includes('Script')) continue
      const cells = line.split('|').map((c) => c.trim())
      pairs.push([cells[1], cells[2]], [cells[4], cells[5]])
    }
    expect(pairs.length).toBeGreaterThanOrEqual(20)
    let checked = 0
    for (const [script, latin] of pairs) {
      const ch = script.split(' ')[0]
      const letter = SORANI_LETTERS.find((x) => x.char === ch)
      if (!letter) continue
      const values = latin.split('/').map((v) => v.trim()).filter((v) => v !== 'û')
      for (const v of values) expect(letter.latin, `${ch} -> ${v}`).toContain(v)
      checked++
    }
    expect(checked).toBe(19)
    expect(byChar(SORANI_LETTERS, 'وو').latin).toEqual(['û'])
  })

  it('Sorani: plain consonants are their Latin letter and there are no digraphs', () => {
    const plain = { ب: 'b', پ: 'p', ت: 't', د: 'd', ر: 'r', ز: 'z', س: 's', ف: 'f', ڤ: 'v', ک: 'k', گ: 'g', ل: 'l', م: 'm', ن: 'n', ه: 'h' }
    for (const [ch, latin] of Object.entries(plain)) expect(byChar(SORANI_LETTERS, ch).latin).toEqual([latin])
    for (const x of SORANI_LETTERS) for (const v of x.latin) expect(v).not.toMatch(/sh|ch|kh|gh|zh/)
  })

  it('Persian: the learner scheme', () => {
    const expected: Record<string, string[]> = {
      ا: ['â'], آ: ['â'], ب: ['b'], پ: ['p'], ت: ['t'], ث: ['s'], ج: ['j'], چ: ['ch'], ح: ['h'], خ: ['kh'],
      د: ['d'], ذ: ['z'], ر: ['r'], ز: ['z'], ژ: ['zh'], س: ['s'], ش: ['sh'], ص: ['s'], ض: ['z'], ط: ['t'],
      ظ: ['z'], ع: ["'"], غ: ['gh'], ف: ['f'], ق: ['gh'], ک: ['k'], گ: ['g'], ل: ['l'], م: ['m'], ن: ['n'],
      و: ['v', 'u', 'o', 'ow'], ه: ['h', 'e'], ی: ['y', 'i', 'ey'],
    }
    expect(Object.keys(expected).sort()).toEqual(chars(PERSIAN_LETTERS).sort())
    for (const x of PERSIAN_LETTERS) expect(x.latin, x.char).toEqual(expected[x.char])
    for (const x of PERSIAN_LETTERS) for (const v of x.latin) expect(v).not.toMatch(/x|q|c(?!h)/)
    for (const row of ['| خ | kh |', '| ق and غ | gh |', '| ج | j |', '| و consonant | v |', '| ی consonant | y |', "| ع / ء | ' |"]) {
      expect(guide).toContain(row)
    }
  })
})

describe('contextual forms', () => {
  it('gives joining letters four shapes and non-joiners two', () => {
    for (const x of [...SORANI_LETTERS, ...PERSIAN_LETTERS]) {
      const forms = contextualForms(x)
      if (x.joinsLeft) {
        expect(forms.map((f) => f.text)).toEqual([x.char, x.char + ZWJ, ZWJ + x.char + ZWJ, ZWJ + x.char])
      } else {
        expect(forms.map((f) => f.position)).toEqual(['isolated', 'final'])
        expect(forms[1].text).toBe(ZWJ + x.char)
      }
    }
  })
})

describe('letter quiz', () => {
  it('builds rounds with four options of distinct sounds, including the answer', () => {
    let seed = 1
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (const letters of [SORANI_LETTERS, PERSIAN_LETTERS]) {
      const quiz = makeQuiz(letters, 8, random)
      expect(quiz).toHaveLength(8)
      expect(new Set(quiz.map((q) => q.letter.char)).size).toBe(8)
      for (const q of quiz) {
        expect(q.options).toHaveLength(4)
        expect(q.options).toContain(q.letter)
        expect(q.letter.latin.length).toBeGreaterThan(0)
        const sounds = q.options.flatMap((o) => o.latin)
        expect(new Set(sounds).size).toBe(sounds.length)
      }
    }
  })
})
