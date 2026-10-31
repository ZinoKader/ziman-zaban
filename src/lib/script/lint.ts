import type { TargetLang } from '@/content/types'
import { canonicalize } from './normalize'

export interface LintIssue {
  severity: 'error' | 'warning'
  message: string
}

const HARAKAT = /[\u064B-\u0652\u0670]/

/** Orthography rules for the Arabic-script form of a word or sentence. */
export function lintScript(text: string, lang: TargetLang): LintIssue[] {
  const issues: LintIssue[] = []
  const err = (message: string) => issues.push({ severity: 'error', message })
  const warn = (message: string) => issues.push({ severity: 'warning', message })

  if (/[A-Za-z]/.test(text)) err('Latin letters inside the script form')
  const withoutTanwin = lang === 'fa' ? text.replace(/ا\u064B/g, 'ا') : text
  if (HARAKAT.test(withoutTanwin)) err('contains harakat (short-vowel marks); write plain orthography')
  if (/\u0640/.test(text)) err('contains tatweel (ـ)')
  if (/[\u200E\u200F\u202A-\u202E]/.test(text)) err('contains bidi control characters')

  if (lang === 'ckb') {
    if (/[ةيكى]/.test(text)) err('uses Arabic ة/ي/ك/ى; Sorani uses ە ی ک')
    if (/ه\u200C/.test(text)) err('uses ه + ZWNJ for the vowel; use ە (U+06D5)')
    if (/ھ/.test(text)) warn('uses ھ (U+06BE); standard Sorani /h/ is ه (U+0647)')
    if (/(^|[\s«(])ر/.test(text)) err('word-initial ر; Sorani always writes ڕ at the start of a word')
    if (/[ثذصضطظ]/.test(text)) warn('contains an Arabic-only letter (ث ذ ص ض ط ظ); fine for names and loans, otherwise check')
    if (/[آأإ]/.test(text)) warn('contains آ/أ/إ, which standard Sorani does not use (write ئا)')
  } else {
    if (/[يكىة]/.test(text)) err('uses Arabic ي/ك/ى/ة; Persian uses ی ک')
    if (/[ەێۆڵڕڤ]/.test(text)) err('contains Kurdish-only letters')
    if (/(^|\s)(ن?می) (?=\S)/.test(text)) err('the verb prefix می must be joined with a ZWNJ (می‌), not a space')
    if (/\S (ها|های|هایی)(?=$|[\s.،؟!])/.test(text)) warn('plural ها written after a space; usually joined with ZWNJ')
  }

  if (canonicalize(text, lang) !== text) err(`not in canonical form; expected "${canonicalize(text, lang)}"`)
  return issues
}

const SORANI_LATIN = /^[a-zçêîûşřłḧẍ' \-.,!?;:()…]+$/i
const PERSIAN_LATIN = /^[a-zâ' \-.,!?;:()…]+$/i

/** Romanization conventions (see docs/CONTENT_GUIDE.md). */
export function lintLatin(latin: string, lang: TargetLang): LintIssue[] {
  const issues: LintIssue[] = []
  const t = latin.normalize('NFC')
  if (t !== latin) issues.push({ severity: 'error', message: 'romanization is not NFC-normalized' })
  if (lang === 'ckb') {
    if (!SORANI_LATIN.test(t))
      issues.push({ severity: 'error', message: `Sorani romanization has characters outside Hawar Latin: "${latin}"` })
    if (/sh|ch|kh|gh/i.test(t))
      issues.push({ severity: 'warning', message: 'Sorani romanization uses digraphs; Hawar uses ş ç x ẍ' })
  } else {
    if (!PERSIAN_LATIN.test(t))
      issues.push({ severity: 'error', message: `Persian romanization has characters outside the learner scheme: "${latin}"` })
    if (/[xq]/i.test(t)) issues.push({ severity: 'error', message: 'Persian romanization uses x/q; write kh/gh' })
    if (/c(?!h)/i.test(t)) issues.push({ severity: 'error', message: 'Persian romanization uses c; write ch, k or s' })
  }
  return issues
}
