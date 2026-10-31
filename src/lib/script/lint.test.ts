import type { TargetLang } from '@/content/types'
import { lintLatin, lintScript, type LintIssue } from './lint'

const messages = (issues: LintIssue[], severity?: LintIssue['severity']) =>
  issues.filter((i) => !severity || i.severity === severity).map((i) => i.message)

function expectRule(issues: LintIssue[], severity: LintIssue['severity'], pattern: RegExp) {
  expect(messages(issues, severity).some((m) => pattern.test(m)), `expected a ${severity} matching ${pattern}, got ${JSON.stringify(issues)}`).toBe(true)
}

function expectNoRule(issues: LintIssue[], pattern: RegExp) {
  expect(messages(issues).filter((m) => pattern.test(m))).toEqual([])
}

const GOOD: Record<TargetLang, string[]> = {
  ckb: [
    'سڵاو',
    'خوات لەگەڵ',
    'بەیانیت باش',
    'چۆنی؟',
    'ڕۆژ باش',
    'هاوڕێ',
    'خۆشحاڵم بە ناسینت',
    'من سارام.',
    'ناوم سارایە.',
    'ئەمە خێزانەکەمە.',
  ],
  fa: [
    'سلام',
    'لطفاً',
    'خواهش می‌کنم',
    'نمی‌دانم',
    'آن‌ها',
    'حال شما چطور است؟',
    'من سارا هستم.',
    'متأهل',
    'کتاب‌ها',
    'خانۀ من',
  ],
}

describe('lintScript', () => {
  it.each(['ckb', 'fa'] as const)('reports nothing for well-formed %s text', (lang) => {
    for (const text of GOOD[lang]) expect(lintScript(text, lang), text).toEqual([])
  })

  describe('rules for both languages', () => {
    it.each(['ckb', 'fa'] as const)('%s: Latin letters', (lang) => {
      expectRule(lintScript('سلام a', lang), 'error', /Latin letters/)
    })

    it.each(['ckb', 'fa'] as const)('%s: harakat', (lang) => {
      expectRule(lintScript('مَن', lang), 'error', /harakat/)
    })

    it('Persian tanwin on alef is not harakat', () => {
      expectNoRule(lintScript('لطفاً', 'fa'), /harakat/)
      expectRule(lintScript('لطفاً', 'ckb'), 'error', /harakat/)
    })

    it.each(['ckb', 'fa'] as const)('%s: tatweel', (lang) => {
      expectRule(lintScript('مـن', lang), 'error', /tatweel/)
    })

    it.each(['ckb', 'fa'] as const)('%s: bidi controls', (lang) => {
      expectRule(lintScript('\u200Fمن', lang), 'error', /bidi/)
      expectRule(lintScript('من\u202B', lang), 'error', /bidi/)
    })

    it.each(['ckb', 'fa'] as const)('%s: non-canonical text reports the expected form', (lang) => {
      expectRule(lintScript('من  تو', lang), 'error', /not in canonical form; expected "من تو"/)
    })
  })

  describe('Sorani rules', () => {
    it('Arabic ة ي ك ى', () => {
      for (const t of ['تکایة', 'کچي', 'كچ', 'ماڵى']) expectRule(lintScript(t, 'ckb'), 'error', /Arabic ة\/ي\/ك\/ى/)
    })

    it('ه + ZWNJ for the vowel', () => {
      expectRule(lintScript('باشه\u200C', 'ckb'), 'error', /ه \+ ZWNJ/)
    })

    it('heh doachashmee is a warning', () => {
      expectRule(lintScript('ھەبوون', 'ckb'), 'warning', /U\+06BE/)
    })

    it('word-initial ر', () => {
      expectRule(lintScript('رۆژ', 'ckb'), 'error', /word-initial ر/)
      expectRule(lintScript('ئەمڕۆ رۆژی باشە', 'ckb'), 'error', /word-initial ر/)
      expectRule(lintScript('«رووناک»', 'ckb'), 'error', /word-initial ر/)
      expectNoRule(lintScript('شار', 'ckb'), /word-initial ر/)
      expectNoRule(lintScript('برا', 'ckb'), /word-initial ر/)
    })

    it('Arabic-only letters are a warning', () => {
      for (const t of ['ثانیە', 'ذەهەب', 'صەد', 'ضەرەر', 'طەیارە', 'ظولم']) {
        expectRule(lintScript(t, 'ckb'), 'warning', /Arabic-only letter/)
      }
    })

    it('آ أ إ are a warning', () => {
      for (const t of ['آو', 'أمل', 'إسلام']) expectRule(lintScript(t, 'ckb'), 'warning', /آ\/أ\/إ/)
      expectNoRule(lintScript('ئاو', 'ckb'), /آ\/أ\/إ/)
    })

    it('does not apply Persian rules to Sorani', () => {
      expectNoRule(lintScript('دەچم بۆ ماڵەوە', 'ckb'), /Kurdish-only/)
    })
  })

  describe('Persian rules', () => {
    it('Arabic ي ك ى ة', () => {
      for (const t of ['كتاب', 'خيلي', 'مرسى', 'مدرسة']) expectRule(lintScript(t, 'fa'), 'error', /Arabic ي\/ك\/ى\/ة/)
    })

    it('Kurdish-only letters', () => {
      for (const t of ['خانە', 'سڵام', 'ڕاه', 'ڤیلا', 'کێ', 'تۆ']) expectRule(lintScript(t, 'fa'), 'error', /Kurdish-only/)
    })

    it('می / نمی followed by a space', () => {
      expectRule(lintScript('می خواهم', 'fa'), 'error', /می‌/)
      expectRule(lintScript('من نمی دانم', 'fa'), 'error', /می‌/)
      expectNoRule(lintScript('می‌خواهم', 'fa'), /می‌/)
      expectNoRule(lintScript('نمی‌دانم', 'fa'), /می‌/)
    })

    it('plural ها after a space is a warning', () => {
      expectRule(lintScript('کتاب ها', 'fa'), 'warning', /plural ها/)
      expectRule(lintScript('بچه های من', 'fa'), 'warning', /plural ها/)
      expectNoRule(lintScript('کتاب‌ها', 'fa'), /plural ها/)
      expectNoRule(lintScript('هاشم', 'fa'), /plural ها/)
    })
  })
})

describe('lintLatin', () => {
  it('accepts Hawar Sorani romanization', () => {
    for (const t of ['sław', 'xoşḧałim be nasînit', 'çonî?', 'hawřê', 'bełê', 'ẍerîb', "min Saram.", 'kemêk']) {
      expect(lintLatin(t, 'ckb'), t).toEqual([])
    }
  })

  it('accepts the Persian learner scheme', () => {
    for (const t of ['salâm', 'khodâhâfez', "mote'ahhel", 'hâl-e shomâ chetor ast?', 'man Sârâ hastam.', 'rafigh']) {
      expect(lintLatin(t, 'fa'), t).toEqual([])
    }
  })

  it('requires NFC', () => {
    expectRule(lintLatin('be\u0302ł', 'ckb'), 'error', /NFC/)
    expectRule(lintLatin('sala\u0302m', 'fa'), 'error', /NFC/)
  })

  it('Sorani: characters outside Hawar are errors, digraphs are warnings', () => {
    expectRule(lintLatin('šar', 'ckb'), 'error', /outside Hawar/)
    expectRule(lintLatin('salâm', 'ckb'), 'error', /outside Hawar/)
    expectRule(lintLatin('min2', 'ckb'), 'error', /outside Hawar/)
    expectRule(lintLatin('shar', 'ckb'), 'warning', /digraphs/)
    expectRule(lintLatin('xoshhal', 'ckb'), 'warning', /digraphs/)
    expectNoRule(lintLatin('şar', 'ckb'), /digraphs/)
  })

  it('Persian: characters outside the scheme, x/q and bare c are errors', () => {
    expectRule(lintLatin('şomâ', 'fa'), 'error', /outside the learner scheme/)
    expectRule(lintLatin('sālām', 'fa'), 'error', /outside the learner scheme/)
    expectRule(lintLatin('xâne', 'fa'), 'error', /x\/q/)
    expectRule(lintLatin('rafiq', 'fa'), 'error', /x\/q/)
    expectRule(lintLatin('ketâb-e calâs', 'fa'), 'error', /uses c;/)
    expectNoRule(lintLatin('chetori', 'fa'), /uses c;/)
    expectNoRule(lintLatin('khâne', 'fa'), /x\/q/)
  })
})
