import { describe, expect, it } from 'vitest'
import { acceptedForms, conceptById } from '@/content'
import type { Candidate } from '@/lib/curriculum'
import { newCard, Rating } from '@/lib/srs'
import { chooseMode, closestForm, fastMsFor, matchRecall, recallGrade } from './grading'

const thankYou = conceptById.get('thank-you')!
const faForms = acceptedForms(thankYou.fa!)
const ckbForms = acceptedForms(thankYou.ckb!)

function candidate(stability?: number): Candidate {
  const card = stability === undefined ? undefined : { ...newCard(new Date()), stability, reps: 5, state: 2 }
  return { key: 'ckb:recall:thank-you', itemId: 'thank-you', isNew: !card, order: 0, card }
}

describe('matchRecall', () => {
  it('accepts Arabic script and Latin letters', () => {
    expect(matchRecall('سوپاس', ckbForms, 'ckb').grade).toBe('exact')
    expect(matchRecall('supas', ckbForms, 'ckb').grade).toBe('exact')
    expect(matchRecall('Supas ', ckbForms, 'ckb').grade).toBe('exact')
  })

  it('accepts variants and returns the matched original form', () => {
    const r = matchRecall('mersi', faForms, 'fa')
    expect(r.grade).toBe('exact')
    expect(r.expected.register).toBe('colloquial')
  })

  it('ignores a missing question mark', () => {
    const how = acceptedForms(conceptById.get('how-are-you')!.ckb!)
    const r = matchRecall('çonî', how, 'ckb')
    expect(r.grade).toBe('exact')
    expect(r.expected.latin).toBe('çonî?')
  })

  it('folds spelling details to close and small slips to typo', () => {
    expect(matchRecall('salam', acceptedForms(conceptById.get('hello')!.fa!), 'fa').grade).toBe('close')
    expect(matchRecall('moteshakeram', faForms, 'fa').grade).not.toBe('wrong')
    expect(matchRecall('nan', ckbForms, 'ckb').grade).toBe('wrong')
  })
})

describe('closestForm', () => {
  it('picks the accepted form the wrong answer was nearest to', () => {
    expect(closestForm('mersy', faForms, 'fa').latin).toBe('mersi')
  })
})

describe('recallGrade', () => {
  const base = { hintsUsed: 0, responseMs: 2000, fastMs: 5000, attempt: 0 }
  it('maps outcomes to FSRS grades', () => {
    expect(recallGrade({ ...base, match: 'wrong' })).toBe(Rating.Again)
    expect(recallGrade({ ...base, match: 'typo' })).toBe(Rating.Hard)
    expect(recallGrade({ ...base, match: 'exact' })).toBe(Rating.Easy)
    expect(recallGrade({ ...base, match: 'close', responseMs: 9000 })).toBe(Rating.Good)
  })
  it('caps at Hard with a hint', () => {
    expect(recallGrade({ ...base, match: 'exact', hintsUsed: 1 })).toBe(Rating.Hard)
    expect(recallGrade({ ...base, match: null, selfGrade: Rating.Easy, hintsUsed: 2 })).toBe(Rating.Hard)
  })
  it('never awards Easy on a re-ask', () => {
    expect(recallGrade({ ...base, match: 'exact', attempt: 1 })).toBe(Rating.Good)
    expect(recallGrade({ ...base, match: null, selfGrade: Rating.Easy, attempt: 1 })).toBe(Rating.Good)
  })
  it('counts an override as Good', () => {
    expect(recallGrade({ ...base, match: 'wrong', overridden: true })).toBe(Rating.Good)
    expect(recallGrade({ ...base, match: 'wrong', overridden: true, hintsUsed: 1 })).toBe(Rating.Hard)
  })
})

describe('chooseMode', () => {
  const always = () => 0
  const never = () => 0.99
  it('types new, young and re-asked items', () => {
    expect(chooseMode(candidate(), 0, always)).toBe('typed')
    expect(chooseMode(candidate(3), 0, always)).toBe('typed')
    expect(chooseMode(candidate(30), 1, always)).toBe('typed')
  })
  it('sometimes asks for well-known items out loud', () => {
    expect(chooseMode(candidate(30), 0, always)).toBe('spoken')
    expect(chooseMode(candidate(30), 0, never)).toBe('typed')
  })
})

describe('fastMsFor', () => {
  it('gives longer words more time', () => {
    expect(fastMsFor(faForms[3], 'latin')).toBeGreaterThan(fastMsFor(faForms[0], 'latin'))
  })
})
