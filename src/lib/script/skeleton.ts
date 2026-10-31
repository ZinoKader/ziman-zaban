import type { TargetLang } from '@/content/types'
import { canonicalize } from './normalize'

/*
 * Consonant/vowel skeletons let the validator check that a romanization and the
 * Arabic-script form describe the same word, without needing a full (impossible)
 * transliterator: Sorani leaves /i/ unwritten and Persian leaves out short vowels.
 */

const SORANI_SCRIPT: Record<string, string> = {
  ا: 'a', ب: 'b', پ: 'p', ت: 't', ج: 'c', چ: 'ç', ح: 'h', خ: 'x', د: 'd', ر: 'r', ڕ: 'ř',
  ز: 'z', ژ: 'j', س: 's', ش: 'ş', ع: '', غ: 'ẍ', ف: 'f', ڤ: 'v', ق: 'q', ک: 'k', گ: 'g',
  ل: 'l', ڵ: 'ł', م: 'm', ن: 'n', ه: 'h', ە: 'e', و: 'W', ۆ: 'o', ی: 'Y', ێ: 'ê', ئ: '',
  ء: '', آ: 'a', ص: 's', ط: 't', ض: 'z', ظ: 'z', ذ: 'z', ث: 's',
}

export function soraniScriptSkeleton(script: string): string {
  const t = canonicalize(script, 'ckb')
  return words(t)
    .map((w) => [...w].map((ch) => SORANI_SCRIPT[ch] ?? (/[\u0600-\u06FF]/.test(ch) ? '?' : '')).join(''))
    .map(collapseGlides)
    .join(' ')
}

export function soraniLatinSkeleton(latin: string): string {
  return words(latin.normalize('NFC').toLowerCase())
    .map((w) =>
      w
        .replace(/['ʼ’`ʿ]/g, '')
        .replace(/rr/g, 'ř')
        .replace(/ll/g, 'ł')
        .replace(/ḧ|ḥ/g, 'h')
        .replace(/ẍ|ğ/g, 'ẍ')
        .replace(/sh/g, 'ş')
        .replace(/ch/g, 'ç')
        .replace(/û|u|w/g, 'W')
        .replace(/î|y/g, 'Y')
        .replace(/i/g, '')
        .replace(/[^a-zçşêřłẍWY]/g, ''),
    )
    .map(collapseGlides)
    .join(' ')
}

function collapseGlides(s: string): string {
  return s.replace(/W+/g, 'W').replace(/Y+/g, 'Y')
}

const PERSIAN_SCRIPT: Record<string, string> = {
  ب: 'b', پ: 'p', ت: 't', ط: 't', ث: 's', س: 's', ص: 's', ج: 'j', چ: 'C', ح: 'h', خ: 'X',
  د: 'd', ذ: 'z', ز: 'z', ض: 'z', ظ: 'z', ر: 'r', ژ: 'Z', ش: 'S', غ: 'G', ق: 'G', ف: 'f',
  ک: 'k', گ: 'g', ل: 'l', م: 'm', ن: 'n', ه: 'h', '\u064B': 'n',
}

export function persianScriptSkeleton(script: string): string {
  const t = canonicalize(script, 'fa').replace(/\u200C/g, '')
  return words(t)
    .map((w) => {
      const chars = [...w]
      return chars
        .map((ch, i) => {
          if (ch === 'ه' && i === chars.length - 1 && i > 0) return '' // silent final heh (خانه)
          return PERSIAN_SCRIPT[ch] ?? ''
        })
        .join('')
        .replace(/(.)\1+/g, '$1')
    })
    .join('')
}

export function persianLatinSkeleton(latin: string): string {
  return words(latin.normalize('NFC').toLowerCase())
    .map((w) =>
      w
        .replace(/kh|x/g, 'X')
        .replace(/sh|š/g, 'S')
        .replace(/ch|č/g, 'C')
        .replace(/zh|ž/g, 'Z')
        .replace(/gh|q|ğ/g, 'G')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[aeiouyvw'ʼ’`-]/g, '')
        .replace(/(.)\1+/g, '$1'),
    )
    .join('')
}

function words(t: string): string[] {
  return t
    .replace(/[.,!?;:،؛؟«»"()[\]…]/g, ' ')
    .split(/[\s\u200C]+/)
    .filter(Boolean)
}

export interface SkeletonCheck {
  ok: boolean
  script: string
  latin: string
}

/** Does the romanization plausibly spell the same word as the script? */
export function checkRomanization(script: string, latin: string, lang: TargetLang): SkeletonCheck {
  if (lang === 'ckb') {
    const s = soraniScriptSkeleton(script).replace(/ /g, '')
    const l = soraniLatinSkeleton(latin).replace(/ /g, '')
    return { ok: s === l, script: s, latin: l }
  }
  const s = persianScriptSkeleton(script)
  const l = persianLatinSkeleton(latin)
  // Word-final h is ambiguous between silent ه (khâne) and real /h/ (râh), so allow it either way.
  const ok = s === l || s.replace(/h/g, '') === l.replace(/h/g, '')
  return { ok, script: s, latin: l }
}
