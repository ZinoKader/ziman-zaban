import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  buildExport,
  composeComment,
  exportFileName,
  parseComment,
  parseReviewFile,
  serializeExport,
  type Decision,
} from './export'

/** Mirrors `interface Review` and the file layout read by scripts/validate-content.ts. Strict: no extra keys. */
const validatorReview = z.strictObject({
  key: z.string().regex(/^(concept|sentence|qa):(ckb|fa):[^:].*$/),
  verdict: z.enum(['correct', 'incorrect']),
  reviewer: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comment: z.string().min(1).optional(),
})
const validatorFile = z.strictObject({ reviews: z.array(validatorReview) })

const decisions: Record<string, Decision> = {
  'concept:ckb:water': { verdict: 'correct', reviewer: 'Aras', date: '2026-10-31' },
  'sentence:ckb:i-am-sara': {
    verdict: 'incorrect',
    reviewer: 'Aras',
    date: '2026-10-30',
    comment: '[Spelling] Correct form: من سارام — fine otherwise',
    issues: ['spelling'],
    correctForm: 'من سارام',
    note: 'fine otherwise',
  },
  'qa:ckb:what-is-your-name': { verdict: 'correct', reviewer: 'Aras', date: '2026-10-31', comment: '' },
  'concept:fa:water': { verdict: 'correct', reviewer: 'Sara', date: '2026-10-31' },
}

describe('review export', () => {
  it('matches the shape the validator reads, with nothing extra', () => {
    const file = buildExport(decisions, 'ckb')
    const roundTripped = JSON.parse(serializeExport(file))
    expect(validatorFile.safeParse(roundTripped).success).toBe(true)
    expect(roundTripped).toEqual({
      reviews: [
        {
          key: 'sentence:ckb:i-am-sara',
          verdict: 'incorrect',
          reviewer: 'Aras',
          date: '2026-10-30',
          comment: '[Spelling] Correct form: من سارام — fine otherwise',
        },
        { key: 'concept:ckb:water', verdict: 'correct', reviewer: 'Aras', date: '2026-10-31' },
        { key: 'qa:ckb:what-is-your-name', verdict: 'correct', reviewer: 'Aras', date: '2026-10-31' },
      ],
    })
  })

  it('only exports the chosen language', () => {
    expect(buildExport(decisions, 'fa').reviews.map((r) => r.key)).toEqual(['concept:fa:water'])
  })

  it('omits the comment key entirely when there is no comment', () => {
    const [r] = buildExport({ 'concept:fa:x': { verdict: 'correct', reviewer: 'A', date: '2026-01-02' } }, 'fa').reviews
    expect(Object.keys(r)).toEqual(['key', 'verdict', 'reviewer', 'date'])
  })

  it('names the file reviews-<lang>-<reviewer>-<date>.json', () => {
    expect(exportFileName('ckb', 'Aras Ahmed', '2026-10-31')).toBe('reviews-ckb-aras-ahmed-2026-10-31.json')
    expect(exportFileName('fa', '  ', '2026-10-31')).toBe('reviews-fa-reviewer-2026-10-31.json')
    expect(exportFileName('fa', 'سارا', '2026-10-31')).toBe('reviews-fa-سارا-2026-10-31.json')
  })

  it('parses its own files back and rejects other JSON', () => {
    const text = serializeExport(buildExport(decisions, 'ckb'))
    expect(parseReviewFile(text)?.reviews).toHaveLength(3)
    expect(parseReviewFile('{"cards": {}}')).toBeNull()
    expect(parseReviewFile('not json')).toBeNull()
    expect(parseReviewFile('{"reviews":[{"key":"word:ckb:x","verdict":"correct","reviewer":"A","date":"2026-01-01"}]}')).toBeNull()
  })
})

describe('incorrect comments', () => {
  it('lead with the issue tags and an English "Correct form:" prefix', () => {
    expect(composeComment({ issues: ['spelling', 'meaning'], correctForm: ' ئاو ', note: 'not آو' })).toBe(
      '[Spelling, Meaning] Correct form: ئاو — not آو',
    )
    expect(composeComment({ issues: [], correctForm: '', note: 'Say آب می‌خوام' })).toBe('Say آب می‌خوام')
    expect(composeComment({ issues: [], correctForm: '', note: '  ' })).toBe('')
  })

  it('round-trip through parseComment', () => {
    const cases = [
      { issues: ['spelling', 'meaning'] as const, correctForm: 'ئاو', note: 'not آو' },
      { issues: [] as const, correctForm: 'نان', note: '' },
      { issues: ['unnatural'] as const, correctForm: '', note: 'nobody says this' },
      { issues: [] as const, correctForm: '', note: 'free text [with brackets]' },
    ]
    for (const c of cases) {
      const detail = { ...c, issues: [...c.issues] }
      expect(parseComment(composeComment(detail))).toEqual(detail)
    }
  })
})
