import type { Form, TargetLang } from '@/content/types'
import { checkRomanization, persianScriptSkeleton, soraniLatinSkeleton, soraniScriptSkeleton } from './skeleton'

interface RawConcept {
  id: string
  ckb?: { primary: Form; variants?: Form[] }
  fa?: { primary: Form; variants?: Form[] }
}

const lexiconFiles = import.meta.glob<{ concepts: RawConcept[] }>('../../content/data/lexicon/*.json', {
  eager: true,
  import: 'default',
})

function lexiconForms(lang: TargetLang): Form[] {
  return Object.values(lexiconFiles).flatMap((file) =>
    file.concepts.flatMap((c) => (c[lang] ? [c[lang].primary, ...(c[lang].variants ?? [])] : [])),
  )
}

describe('checkRomanization: Sorani', () => {
  it.each([
    ['سڵاو', 'sław'],
    ['سوپاس', 'supas'],
    ['تکایە', 'tikaye'],
    ['بەڵێ', 'bełê'],
    ['نەخێر', 'nexêr'],
    ['چۆنی؟', 'çonî?'],
    ['بەیانیت باش', 'beyanît baş'],
    ['خوات لەگەڵ', 'xwat legeł'],
    ['خوا حافیز', 'xwa ḧafîz'],
    ['ئێوە', 'êwe'],
    ['هاوڕێ', 'hawřê'],
    ['کوڕ', 'kuř'],
    ['منداڵ', 'mindał'],
    ['خۆشحاڵم بە ناسینت', 'xoşḧałim be nasînit'],
    ['ببوورە', 'bibûre'],
    ['شایەنی نییە', 'şayenî nîye'],
    ['ژیان', 'jiyan'],
    ['سوید', 'Swîd'],
  ])('%s = %s', (script, latin) => {
    expect(checkRomanization(script, latin, 'ckb').ok).toBe(true)
  })

  it.each([
    ['سڵاو', 'slaw', 'ڵ written as plain l'],
    ['کوڕ', 'kur', 'ڕ written as plain r'],
    ['هاوڕێ', 'hawre', 'ێ written as e'],
    ['کێ', 'ke', 'ێ written as e'],
    ['باش', 'bas', 'ş written as s'],
    ['سوپاس', 'subas', 'wrong consonant'],
    ['خێزان', 'kêzan', 'x written as k'],
    ['تۆ', 'tu', 'ۆ written as u'],
    ['شار', 'şar baş', 'extra word'],
    ['ئەو', 'ow', 'wrong vowel'],
  ])('%s != %s (%s)', (script, latin) => {
    expect(checkRomanization(script, latin, 'ckb').ok).toBe(false)
  })

  it('exposes comparable skeletons', () => {
    expect(soraniScriptSkeleton('سڵاو')).toBe(soraniLatinSkeleton('sław'))
    expect(soraniScriptSkeleton('ڕۆژ')).toBe('řoj')
    expect(soraniLatinSkeleton('rroj')).toBe('řoj')
  })

  it('flags letters it has no mapping for', () => {
    expect(soraniScriptSkeleton('أ')).toContain('?')
  })
})

describe('checkRomanization: Persian', () => {
  it.each([
    ['سلام', 'salâm'],
    ['خداحافظ', 'khodâhâfez'],
    ['ممنون', 'mamnun'],
    ['متشکرم', 'moteshakkeram'],
    ['لطفاً', 'lotfan'],
    ['بله', 'bale'],
    ['خانه', 'khâne'],
    ['خانواده', 'khânevâde'],
    ['راه', 'râh'],
    ['شهر', 'shahr'],
    ['خواهش می‌کنم', 'khâhesh mikonam'],
    ['حال شما چطور است؟', 'hâl-e shomâ chetor ast?'],
    ['صبح بخیر', 'sobh bekheyr'],
    ['آن‌ها', 'ânhâ'],
    ['رفیق', 'rafigh'],
    ['متأهل', "mote'ahhel"],
    ['بچه', 'bachche'],
  ])('%s = %s', (script, latin) => {
    expect(checkRomanization(script, latin, 'fa').ok).toBe(true)
  })

  it.each([
    ['سلام', 'kalâm', 'wrong first consonant'],
    ['کتاب', 'ketâp', 'b written as p'],
    ['خوب', 'khub khub', 'extra word'],
    ['شما', 'somâ', 'sh written as s'],
    ['دختر', 'doktar', 'kh written as k'],
    ['پدر', 'pedar-bozorg', 'extra syllables'],
    ['زن', 'zam', 'wrong final consonant'],
  ])('%s != %s (%s)', (script, latin) => {
    expect(checkRomanization(script, latin, 'fa').ok).toBe(false)
  })

  it('treats final ه as silent in the script skeleton', () => {
    expect(persianScriptSkeleton('خانه')).toBe('Xn')
    expect(persianScriptSkeleton('شهر')).toBe('Shr')
  })
})

/** Changes the first plain consonant into a clearly different one. */
const SWAP: Record<string, string> = {
  b: 'd', d: 'b', f: 'm', g: 'k', k: 'g', m: 'n', n: 'm', p: 'b', q: 'k', s: 'z', t: 'd', z: 's', l: 'r', r: 'l',
}
function breakLatin(latin: string): string | undefined {
  const i = [...latin].findIndex((ch) => ch in SWAP)
  if (i < 0) return undefined
  const chars = [...latin]
  chars[i] = SWAP[chars[i]]
  return chars.join('')
}

describe.each(['ckb', 'fa'] as const)('checkRomanization over the real %s lexicon', (lang) => {
  const forms = lexiconForms(lang)

  it('the lexicon has forms to check', () => {
    expect(forms.length).toBeGreaterThan(20)
  })

  it('rejects every consistent form once a consonant in its romanization is changed', () => {
    const consistent = forms.filter((f) => checkRomanization(f.script, f.latin, lang).ok)
    expect(consistent.length).toBeGreaterThan(forms.length * 0.9)
    const accepted = consistent
      .map((f) => ({ f, broken: breakLatin(f.latin) }))
      .filter((x): x is { f: Form; broken: string } => !!x.broken)
      .filter(({ f, broken }) => checkRomanization(f.script, broken, lang).ok)
      .map(({ f, broken }) => `${f.script} / ${broken}`)
    expect(accepted).toEqual([])
  })

  it('rejects every form when paired with the romanization of a different word', () => {
    const consistent = forms.filter((f) => checkRomanization(f.script, f.latin, lang).ok)
    const mismatches = consistent
      .map((f, i) => ({ f, other: consistent[(i + 7) % consistent.length] }))
      .filter(({ f, other }) => f.script !== other.script)
      .filter(({ f, other }) => checkRomanization(f.script, other.latin, lang).ok)
      .map(({ f, other }) => `${f.script} / ${other.latin}`)
    expect(mismatches).toEqual([])
  })
})
