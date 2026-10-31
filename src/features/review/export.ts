import { z } from 'zod'
import type { TargetLang } from '@/content/types'

/** One entry of a review file, exactly as `scripts/validate-content.ts` reads it. */
export interface ReviewRecord {
  key: string
  verdict: 'correct' | 'incorrect'
  reviewer: string
  date: string
  comment?: string
}

export interface ReviewFile {
  reviews: ReviewRecord[]
}

export const ISSUES = ['spelling', 'romanization', 'meaning', 'grammar', 'unnatural', 'register'] as const
export type Issue = (typeof ISSUES)[number]

/** Issue names in the exported comment stay English: the comments are read by the content team. */
const ISSUE_LABEL: Record<Issue, string> = {
  spelling: 'Spelling',
  romanization: 'Romanization',
  meaning: 'Meaning',
  grammar: 'Grammar',
  unnatural: 'Unnatural',
  register: 'Register/dialect',
}

export const CORRECT_FORM_PREFIX = 'Correct form:'

export interface Decision {
  verdict: ReviewRecord['verdict']
  reviewer: string
  date: string
  comment?: string
  issues?: Issue[]
  correctForm?: string
  note?: string
}

export interface IncorrectDetail {
  issues: Issue[]
  correctForm: string
  note: string
}

export function composeComment({ issues, correctForm, note }: IncorrectDetail): string {
  const parts: string[] = []
  if (issues.length) parts.push(`[${issues.map((i) => ISSUE_LABEL[i]).join(', ')}]`)
  if (correctForm.trim()) parts.push(`${CORRECT_FORM_PREFIX} ${correctForm.trim()}`)
  if (note.trim()) parts.push(parts.length ? `— ${note.trim()}` : note.trim())
  return parts.join(' ')
}

/** Recovers the structured fields from a comment written by `composeComment`, so imported decisions can be edited. */
export function parseComment(comment: string): IncorrectDetail {
  let rest = comment.trim()
  let issues: Issue[] = []
  const tag = rest.match(/^\[([^\]]*)\]\s*/)
  if (tag) {
    const labels = tag[1].split(',').map((x) => x.trim())
    const found = ISSUES.filter((i) => labels.includes(ISSUE_LABEL[i]))
    if (found.length === labels.length) {
      issues = found
      rest = rest.slice(tag[0].length)
    }
  }
  let correctForm = ''
  if (rest.startsWith(CORRECT_FORM_PREFIX)) {
    const body = rest.slice(CORRECT_FORM_PREFIX.length).trim()
    const dash = body.indexOf(' — ')
    correctForm = dash === -1 ? body : body.slice(0, dash)
    rest = dash === -1 ? '' : body.slice(dash + 3)
  } else if (rest.startsWith('— ')) {
    rest = rest.slice(2)
  }
  return { issues, correctForm: correctForm.trim(), note: rest.trim() }
}

const keyPattern = /^(concept|sentence|qa):(ckb|fa):.+$/

export function buildExport(decisions: Record<string, Decision>, lang: TargetLang): ReviewFile {
  const reviews = Object.entries(decisions)
    .filter(([key]) => keyPattern.test(key) && key.split(':')[1] === lang)
    .sort(([ka, a], [kb, b]) => a.date.localeCompare(b.date) || ka.localeCompare(kb))
    .map(([key, d]): ReviewRecord => {
      const record: ReviewRecord = { key, verdict: d.verdict, reviewer: d.reviewer, date: d.date }
      if (d.comment?.trim()) record.comment = d.comment.trim()
      return record
    })
  return { reviews }
}

export function serializeExport(file: ReviewFile): string {
  return JSON.stringify(file, null, 2) + '\n'
}

function slug(text: string): string {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'reviewer'
  )
}

export function exportFileName(lang: TargetLang, reviewer: string, date: string): string {
  return `reviews-${lang}-${slug(reviewer)}-${date}.json`
}

export const reviewFileSchema = z.object({
  reviews: z.array(
    z.object({
      key: z.string().regex(keyPattern),
      verdict: z.enum(['correct', 'incorrect']),
      reviewer: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      comment: z.string().optional(),
    }),
  ),
})

export function parseReviewFile(text: string): ReviewFile | null {
  try {
    const result = reviewFileSchema.safeParse(JSON.parse(text))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function downloadReviewFile(name: string, file: ReviewFile) {
  const blob = new Blob([serializeExport(file)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
