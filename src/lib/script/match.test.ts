import type { Form } from '@/content/types'
import { levenshtein, matchBaseAnswer, matchTargetAnswer } from './match'
import { foldForMatch } from './normalize'

const f = (script: string, latin: string): Form => ({ script, latin })

const HELLO_CKB = [f('سڵاو', 'sław')]
const THANKS_FA = [f('ممنون', 'mamnun'), f('مرسی', 'mersi'), f('متشکرم', 'moteshakkeram'), f('سپاس', 'sepâs')]
const SORRY_CKB = [f('ببوورە', 'bibûre'), f('ببورە', 'bibure')]
const YOURE_WELCOME_FA = [f('خواهش می‌کنم', 'khâhesh mikonam')]

/** Replaces the letter at each index with one that does not occur in the word. */
function substitute(word: string, indexes: number[], filler: string): string {
  const chars = [...word]
  for (const i of indexes) chars[i] = filler
  return chars.join('')
}

describe('levenshtein', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(levenshtein('سڵاو', 'سلاو')).toBe(1)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
    expect(levenshtein('same', 'same')).toBe(0)
  })
})

describe('matchTargetAnswer: Arabic script', () => {
  it('exact for the canonical spelling, ignoring surrounding space', () => {
    expect(matchTargetAnswer('سڵاو', HELLO_CKB, 'ckb')).toMatchObject({ grade: 'exact', inputScript: 'arabic' })
    expect(matchTargetAnswer('  سڵاو ', HELLO_CKB, 'ckb').grade).toBe('exact')
  })

  it('exact when only encoding-level differences remain (Arabic kaf/yeh, decomposed letters)', () => {
    expect(matchTargetAnswer('كتاب', [f('کتاب', 'ketâb')], 'fa').grade).toBe('exact')
    expect(matchTargetAnswer('خيلي ممنون', [f('خیلی ممنون', 'kheyli mamnun')], 'fa').grade).toBe('exact')
    expect(matchTargetAnswer('سل\u065Aاو', HELLO_CKB, 'ckb').grade).toBe('exact')
    expect(matchTargetAnswer('تكایة', [f('تکایە', 'tikaye')], 'ckb').grade).toBe('exact')
  })

  it('Persian: leaving out the ZWNJ, or typing a space instead, is close', () => {
    expect(matchTargetAnswer('خواهش میکنم', YOURE_WELCOME_FA, 'fa').grade).toBe('close')
    expect(matchTargetAnswer('خواهش می کنم', YOURE_WELCOME_FA, 'fa').grade).toBe('close')
    expect(matchTargetAnswer('آنها', [f('آن‌ها', 'ânhâ')], 'fa').grade).toBe('close')
  })

  it('Persian: missing tanwin or hamza is close', () => {
    expect(matchTargetAnswer('لطفا', [f('لطفاً', 'lotfan')], 'fa').grade).toBe('close')
    expect(matchTargetAnswer('متاهل', [f('متأهل', "mote'ahhel")], 'fa').grade).toBe('close')
  })

  it('Sorani: ه written for ە is close', () => {
    expect(matchTargetAnswer('باشه', [f('باشە', 'başe')], 'ckb').grade).toBe('close')
    expect(matchTargetAnswer('ئهوه', [f('ئەوە', 'ewe')], 'ckb').grade).toBe('close')
    expect(matchTargetAnswer('تکایه', [f('تکایە', 'tikaye')], 'ckb').grade).toBe('close')
  })

  it('punctuation is close, not wrong', () => {
    expect(matchTargetAnswer('چۆنی', [f('چۆنی؟', 'çonî?')], 'ckb').grade).toBe('close')
  })

  it('one wrong letter in a 4+ letter word is a typo', () => {
    expect(matchTargetAnswer('سلاو', HELLO_CKB, 'ckb').grade).toBe('typo')
    expect(matchTargetAnswer('خداحافض', [f('خداحافظ', 'khodâhâfez')], 'fa').grade).toBe('typo')
    expect(matchTargetAnswer('سوپا', [f('سوپاس', 'supas')], 'ckb').grade).toBe('typo')
  })

  it('wrong for a different word', () => {
    expect(matchTargetAnswer('من', [f('تۆ', 'to')], 'ckb').grade).toBe('wrong')
    expect(matchTargetAnswer('سلام', [f('خداحافظ', 'khodâhâfez')], 'fa').grade).toBe('wrong')
  })

  it('distinguishes Kurdish letters that change the word in short words', () => {
    expect(matchTargetAnswer('کور', [f('کوڕ', 'kuř')], 'ckb').grade).toBe('wrong')
    expect(matchTargetAnswer('کی', [f('کێ', 'kê')], 'ckb').grade).toBe('wrong')
  })

  it.each([
    ['ckb', 'کچ'],
    ['ckb', 'باش'],
    ['fa', 'زن'],
    ['fa', 'خوب'],
  ] as const)('%s %s: no typo allowance under four letters', (lang, word) => {
    const forms = [f(word, 'x')]
    expect(matchTargetAnswer(substitute(word, [0], 'ق'), forms, lang).grade).toBe('wrong')
  })

  it.each([
    ['ckb', 'سوپاس'],
    ['ckb', 'خێزاندار'],
    ['fa', 'ممنون'],
    ['fa', 'خوشوقتم'],
  ] as const)('%s %s: one slip allowed from four letters, two are wrong', (lang, word) => {
    expect([...foldForMatch(word, lang)].length).toBeGreaterThanOrEqual(4)
    expect([...foldForMatch(word, lang)].length).toBeLessThan(9)
    const forms = [f(word, 'x')]
    expect(matchTargetAnswer(substitute(word, [1], 'ظ'), forms, lang).grade).toBe('typo')
    expect(matchTargetAnswer(substitute(word, [1, 3], 'ظ'), forms, lang).grade).toBe('wrong')
  })

  it.each([
    ['ckb', 'خۆشحاڵم بە ناسینت'],
    ['fa', 'خدانگهدار'],
  ] as const)('%s %s: two slips allowed from nine letters, three are wrong', (lang, word) => {
    expect([...foldForMatch(word, lang)].length).toBeGreaterThanOrEqual(9)
    const forms = [f(word, 'x')]
    expect(matchTargetAnswer(substitute(word, [1, 3], 'ظ'), forms, lang).grade).toBe('typo')
    expect(matchTargetAnswer(substitute(word, [1, 3, 5], 'ظ'), forms, lang).grade).toBe('wrong')
  })

  it('matches against every accepted form and returns the one matched', () => {
    const r = matchTargetAnswer('مرسی', THANKS_FA, 'fa')
    expect(r.grade).toBe('exact')
    expect(r.expected.latin).toBe('mersi')
  })

  it('prefers an exact match on a later form over a close match on an earlier one', () => {
    const r = matchTargetAnswer('ببورە', SORRY_CKB, 'ckb')
    expect(r).toMatchObject({ grade: 'exact', expected: { latin: 'bibure' } })
    expect(matchTargetAnswer('ببوره', SORRY_CKB, 'ckb')).toMatchObject({ grade: 'close', expected: { latin: 'bibure' } })
  })
})

describe('matchTargetAnswer: Latin', () => {
  it('exact ignoring case and spacing', () => {
    expect(matchTargetAnswer('sław', HELLO_CKB, 'ckb')).toMatchObject({ grade: 'exact', inputScript: 'latin' })
    expect(matchTargetAnswer('  Sław ', HELLO_CKB, 'ckb').grade).toBe('exact')
    expect(matchTargetAnswer('khâhesh   mikonam', YOURE_WELCOME_FA, 'fa').grade).toBe('exact')
  })

  it('close for spelling-system differences', () => {
    expect(matchTargetAnswer('slaw', HELLO_CKB, 'ckb').grade).toBe('close')
    expect(matchTargetAnswer('sllaw', HELLO_CKB, 'ckb').grade).toBe('close')
    expect(matchTargetAnswer('salam', [f('سلام', 'salâm')], 'fa').grade).toBe('close')
    expect(matchTargetAnswer('xane', [f('خانه', 'khâne')], 'fa').grade).toBe('close')
    expect(matchTargetAnswer('khahesh mi-konam', YOURE_WELCOME_FA, 'fa').grade).toBe('close')
    expect(matchTargetAnswer('bash', [f('باش', 'baş')], 'ckb').grade).toBe('close')
    expect(matchTargetAnswer("mote ahhel", [f('متأهل', "mote'ahhel")], 'fa').grade).toBe('close')
  })

  it('close for vowel quality, keyboard accents and letter variants a learner may use', () => {
    const yes = [f('بەڵێ', 'bełê')]
    expect(matchTargetAnswer('bale', yes, 'ckb').grade).toBe('close')
    expect(matchTargetAnswer('belê', yes, 'ckb').grade).toBe('close')
    expect(matchTargetAnswer('bälé', yes, 'ckb').grade).toBe('close')
    expect(matchTargetAnswer('khaneh', [f('خانه', 'khâne')], 'fa').grade).toBe('close')
    expect(matchTargetAnswer('khoob', [f('خوب', 'khub')], 'fa').grade).toBe('close')
    expect(matchTargetAnswer('chai', [f('چای', 'chây')], 'fa').grade).toBe('close')
    expect(matchTargetAnswer('jwan', [f('جوان', 'cwan')], 'ckb').grade).toBe('close')
    expect(matchTargetAnswer('ghaza', [f('قاز', 'qaz')], 'ckb').grade).not.toBe('exact')
  })

  it('typo for one slip in a 4+ letter word', () => {
    expect(matchTargetAnswer('supaz', [f('سوپاس', 'supas')], 'ckb').grade).toBe('typo')
    expect(matchTargetAnswer('mamnum', THANKS_FA, 'fa')).toMatchObject({ grade: 'typo', expected: { latin: 'mamnun' } })
  })

  it('two slips from nine letters, three are wrong', () => {
    expect(matchTargetAnswer('moteshakkerom', THANKS_FA, 'fa').grade).toBe('typo')
    expect(matchTargetAnswer('motesakkerom', THANKS_FA, 'fa').grade).toBe('typo')
    expect(matchTargetAnswer('motesakkorom', THANKS_FA, 'fa').grade).toBe('wrong')
  })

  it('wrong for short slips and different words', () => {
    expect(matchTargetAnswer('bas', [f('باش', 'baş')], 'ckb').grade).toBe('wrong')
    expect(matchTargetAnswer('kiz', [f('کچ', 'kiç')], 'ckb').grade).toBe('wrong')
    expect(matchTargetAnswer('min', [f('تۆ', 'to')], 'ckb').grade).toBe('wrong')
  })
})

describe('matchTargetAnswer: empty input', () => {
  it('is wrong and reports the primary form', () => {
    expect(matchTargetAnswer('   ', THANKS_FA, 'fa')).toEqual({ grade: 'wrong', expected: THANKS_FA[0], inputScript: 'latin' })
  })
})

describe('matchBaseAnswer', () => {
  it('exact ignoring case and punctuation', () => {
    expect(matchBaseAnswer('Hello!', ['hello'])).toEqual({ grade: 'exact', expected: 'hello' })
    expect(matchBaseAnswer("you're welcome", ["you're welcome"]).grade).toBe('exact')
    expect(matchBaseAnswer('youre welcome', ["you're welcome"]).grade).toBe('exact')
  })

  it("'to' and 'att' are optional for verbs", () => {
    expect(matchBaseAnswer('eat', ['to eat']).grade).toBe('exact')
    expect(matchBaseAnswer('to eat', ['eat']).grade).toBe('exact')
    expect(matchBaseAnswer('äta', ['att äta']).grade).toBe('exact')
    expect(matchBaseAnswer('att vara', ['att vara']).grade).toBe('exact')
  })

  it('articles are optional', () => {
    expect(matchBaseAnswer('the family', ['family']).grade).toBe('exact')
    expect(matchBaseAnswer('an apple', ['apple']).grade).toBe('exact')
    expect(matchBaseAnswer('en familj', ['familj']).grade).toBe('exact')
    expect(matchBaseAnswer('ett namn', ['namn']).grade).toBe('exact')
  })

  it('leading whitespace does not stop the article from being dropped', () => {
    expect(matchBaseAnswer('  to eat', ['to eat']).grade).toBe('exact')
    expect(matchBaseAnswer(' the family', ['family']).grade).toBe('exact')
  })

  it('options separated by / or ; are each accepted', () => {
    expect(matchBaseAnswer('she', ['he / she'])).toEqual({ grade: 'exact', expected: 'she' })
    expect(matchBaseAnswer('hon', ['han / hon']).grade).toBe('exact')
    expect(matchBaseAnswer('thanks', ['thank you; thanks']).grade).toBe('exact')
    expect(matchBaseAnswer('he / she', ['he / she']).grade).toBe('wrong')
  })

  it('parenthesised parts are optional', () => {
    expect(matchBaseAnswer('from', ['from (a place)']).grade).toBe('exact')
    expect(matchBaseAnswer('uncle', ['(paternal) uncle']).grade).toBe('exact')
    expect(matchBaseAnswer('to be from', ['to be from (a place)']).grade).toBe('exact')
  })

  it('a typo in a longer word is a typo, short words must be exact', () => {
    expect(matchBaseAnswer('thnk you', ['thank you'])).toEqual({ grade: 'typo', expected: 'thank you' })
    expect(matchBaseAnswer('morhter', ['mother']).grade).toBe('wrong')
    expect(matchBaseAnswer('mothr', ['mother']).grade).toBe('typo')
    expect(matchBaseAnswer('yet', ['yes']).grade).toBe('wrong')
  })

  it('prefers an exact option over an earlier typo', () => {
    expect(matchBaseAnswer('sister', ['sisters', 'sister'])).toEqual({ grade: 'exact', expected: 'sister' })
  })

  it('wrong for empty or unrelated answers', () => {
    expect(matchBaseAnswer('', ['hello'])).toEqual({ grade: 'wrong', expected: 'hello' })
    expect(matchBaseAnswer('the', ['hello']).grade).toBe('wrong')
    expect(matchBaseAnswer('goodbye', ['hello']).grade).toBe('wrong')
  })
})
