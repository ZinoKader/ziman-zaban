import type { TargetLang } from '@/content/types'

/** Course words (concept ids) that illustrate each spelling rule. Missing ids are skipped. */
export const VOWEL_RULES = {
  ckb: {
    unwritten: ['woman', 'i', 'sorry'],
    eh: ['to-have', 'okay', 'only'],
    waw: ['country', 'son', 'paternal-aunt'],
    yeh: ['what', 'who', 'kurdish'],
    seat: ['he-she', 'we', 'english'],
  },
  fa: {
    unwritten: ['i', 'daughter', 'father'],
    alef: ['that', 'name', 'he-she'],
    vav: ['country', 'friend', 'you', 'baby'],
    yeh: ['maternal-uncle', 'who'],
    heh: ['maternal-aunt', 'paternal-aunt', 'no'],
    zwnj: ['they', 'older', 'youre-welcome'],
  },
} as const satisfies Record<TargetLang, Record<string, readonly string[]>>

export type SoraniVowelRule = keyof (typeof VOWEL_RULES)['ckb']
export type PersianVowelRule = keyof (typeof VOWEL_RULES)['fa']

/** Persian letters that share a sound; the first is the native one. */
export const PERSIAN_SOUND_GROUPS = [
  { latin: 's', letters: ['س', 'ص', 'ث'] },
  { latin: 'z', letters: ['ز', 'ذ', 'ض', 'ظ'] },
  { latin: 't', letters: ['ت', 'ط'] },
  { latin: 'h', letters: ['ه', 'ح'] },
  { latin: 'gh', letters: ['غ', 'ق'] },
] as const

export const COMPARE_ROWS = [
  { char: 'ە', in: 'ckb', key: 'e' },
  { char: 'ێ', in: 'ckb', key: 'ee' },
  { char: 'ۆ', in: 'ckb', key: 'o' },
  { char: 'ڵ', in: 'ckb', key: 'll' },
  { char: 'ڕ', in: 'ckb', key: 'rr' },
  { char: 'ڤ', in: 'ckb', key: 'v' },
  { char: 'ث', in: 'fa', key: 'se' },
  { char: 'ذ', in: 'fa', key: 'zal' },
  { char: 'ص', in: 'fa', key: 'sad' },
  { char: 'ض', in: 'fa', key: 'zad' },
  { char: 'ط', in: 'fa', key: 'ta' },
  { char: 'ظ', in: 'fa', key: 'za' },
] as const satisfies ReadonlyArray<{ char: string; in: TargetLang; key: string }>

export type CompareKey = (typeof COMPARE_ROWS)[number]['key']

/** Letters both languages use, but read differently. */
export const SAME_LETTER_ROWS = [
  { char: 'و', ckb: 'w · u', fa: 'v · u · o · ow', key: 'waw' },
  { char: 'ق', ckb: 'q', fa: 'gh', key: 'qaf' },
  { char: 'ا', ckb: 'a', fa: 'â', key: 'alef' },
  { char: 'ه', ckb: 'h', fa: 'h · e', key: 'heh' },
  { char: 'ج', ckb: 'c', fa: 'j', key: 'jim' },
] as const

export type SameLetterKey = (typeof SAME_LETTER_ROWS)[number]['key']

/** A greeting spelled out letter by letter, to show joining and the gaps after non-joiners. */
export const ANATOMY_WORD: Record<TargetLang, string> = { ckb: 'hello', fa: 'hello' }
