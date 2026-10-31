import { describe, expect, it } from 'vitest'
import { concepts } from '@/content'
import type { Concept, TargetLang } from '@/content/types'
import { LETTERS, letterByChar } from './letters'
import { letterPositions, pickExample } from './script'

function word(id: string, ckb?: string, fa?: string): Concept {
  return {
    id,
    unit: 'test',
    pos: 'noun',
    level: 'A1',
    gloss: { en: id, sv: id },
    ckb: ckb ? { primary: { script: ckb, latin: id }, sources: [] } : undefined,
    fa: fa ? { primary: { script: fa, latin: id }, sources: [] } : undefined,
  }
}

const L = (lang: TargetLang, ch: string) => letterByChar(lang, ch)!

describe('pickExample', () => {
  it('prefers a word that starts with the letter over a shorter one that contains it', () => {
    const pool = [word('short', 'باش'), word('initial', 'شارەکە')]
    expect(pickExample(L('ckb', 'ش'), 'ckb', pool)?.concept.id).toBe('initial')
  })

  it('picks the shortest among equally good words', () => {
    const pool = [word('long', undefined, 'مادربزرگ'), word('short', undefined, 'مادر'), word('mid', undefined, 'مادرم')]
    expect(pickExample(L('fa', 'م'), 'fa', pool)?.concept.id).toBe('short')
  })

  it('ignores punctuation when measuring and puts multi-word phrases last', () => {
    const pool = [word('phrase', 'زۆر سوپاس'), word('single', 'سوپاسگوزارم؟')]
    expect(pickExample(L('ckb', 'س'), 'ckb', pool)?.concept.id).toBe('single')
  })

  it('does not count half of وو as the letter و', () => {
    const pool = [word('long-u', 'پوور'), word('w', 'کوێ')]
    expect(pickExample(L('ckb', 'و'), 'ckb', pool)?.concept.id).toBe('w')
    expect(pickExample(L('ckb', 'وو'), 'ckb', pool)?.concept.id).toBe('long-u')
    expect(letterPositions('بوون', L('ckb', 'و'), 'ckb')).toEqual([])
  })

  it('treats a Sorani vowel right after the word-initial seat ئ as word-initial', () => {
    const pool = [word('kê', 'کێ'), word('êwe', 'ئێوە')]
    const ex = pickExample(L('ckb', 'ێ'), 'ckb', pool)
    expect(ex?.concept.id).toBe('êwe')
    expect(ex?.initial).toBe(true)
  })

  it('keeps ه and ە apart', () => {
    const pool = [word('e-only', 'باشە'), word('h', 'تەنها')]
    expect(pickExample(L('ckb', 'ه'), 'ckb', pool)?.concept.id).toBe('h')
  })

  it('returns nothing when no word has the letter, and skips the other language', () => {
    expect(pickExample(L('fa', 'ث'), 'fa', [word('a', 'ثث'), word('b', undefined, 'سلام')])).toBeUndefined()
  })

  it('finds a real course word containing the letter for most letters', () => {
    for (const lang of ['ckb', 'fa'] as TargetLang[]) {
      let found = 0
      for (const letter of LETTERS[lang]) {
        const ex = pickExample(letter, lang, concepts)
        if (!ex) continue
        found++
        expect(ex.form.script.normalize('NFC')).toContain(letter.char)
        expect(ex.concept[lang]).toBeDefined()
      }
      expect(found).toBeGreaterThan(LETTERS[lang].length / 2)
    }
  })
})
