import { conceptById } from '../../src/content'
import { englishHeadwords, evidenceLevel, formEvidence, swedishMatches, type FormEvidence } from './reference'

describe('englishHeadwords', () => {
  it('splits alternatives, drops parentheses, punctuation and leading to/articles', () => {
    const heads = englishHeadwords(['to eat (a meal)', 'he / she', 'How are you?'])
    expect(heads).toEqual(expect.arrayContaining(['to eat', 'eat', 'he', 'she', 'How are you', 'how are you']))
    expect(heads.some((h) => h.includes('('))).toBe(false)
  })
})

describe('evidenceLevel', () => {
  const ev = (patch: Partial<FormEvidence>): FormEvidence => ({
    translationTable: false,
    entryExists: false,
    entryGlossMatch: false,
    tatoebaHits: 0,
    romanizationConsistent: true,
    ...patch,
  })

  it('needs two independent sources for strong', () => {
    expect(evidenceLevel(ev({ translationTable: true, entryGlossMatch: true }))).toBe('strong')
    expect(evidenceLevel(ev({ translationTable: true, tatoebaHits: 3 }))).toBe('strong')
    expect(evidenceLevel(ev({ translationTable: true }))).toBe('good')
    expect(evidenceLevel(ev({ entryExists: true, entryGlossMatch: true, tatoebaHits: 2 }))).toBe('good')
    expect(evidenceLevel(ev({ entryExists: true }))).toBe('attested')
    expect(evidenceLevel(ev({ tatoebaHits: 1 }))).toBe('attested')
    expect(evidenceLevel(ev({}))).toBe('none')
  })
})

describe('formEvidence (real reference data)', () => {
  it('confirms common greetings', () => {
    const fa = formEvidence({ script: 'سلام', latin: 'salâm' }, 'fa', ['hello'])
    expect(fa.translationTable).toBe(true)
    expect(fa.tatoebaHits).toBeGreaterThan(0)
    expect(fa.romanizationConsistent).toBe(true)
    expect(evidenceLevel(fa)).toBe('strong')

    const ckb = formEvidence({ script: 'سوپاس', latin: 'supas' }, 'ckb', ['thank you', 'thanks'])
    expect(evidenceLevel(ckb)).not.toBe('none')
  })

  it('finds nothing for a made-up word', () => {
    const ev = formEvidence({ script: 'ژقژقژق', latin: 'zhaghzhaghzhagh' }, 'fa', ['hello'])
    expect(ev).toMatchObject({ translationTable: false, entryExists: false, tatoebaHits: 0 })
    expect(evidenceLevel(ev)).toBe('none')
  })

  it('flags a romanization that does not match the script', () => {
    expect(formEvidence({ script: 'سلام', latin: 'kalâm' }, 'fa', ['hello']).romanizationConsistent).toBe(false)
  })
})

describe('swedishMatches (real reference data)', () => {
  it('confirms a plain Swedish gloss', () => {
    const mother = conceptById.get('mother')
    if (mother) expect(swedishMatches(mother)).toBe(true)
  })

  it('rejects a wrong Swedish gloss', () => {
    const mother = conceptById.get('mother')
    if (mother) expect(swedishMatches({ ...mother, gloss: { ...mother.gloss, sv: 'cykel', svAlt: [] } })).toBe(false)
  })
})
