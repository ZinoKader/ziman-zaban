import { describe, expect, it } from 'vitest'
import { qaFor } from '@/content'
import type { QAAnswer } from '@/content/types'
import { captureSlots, displayValues, fillAnswer, isTemplate, matchQAAnswer, matchTemplate, slotNames, splitTemplate } from './template'

const t = (text: string, latin: string): QAAnswer => ({ text, latin, translation: { en: text, sv: text } })

describe('template parsing', () => {
  it('finds slots, including ones followed by a suffix', () => {
    expect(slotNames('ناوم {name}ە.')).toEqual(['name'])
    expect(splitTemplate('ناوم {name}ە.')).toEqual({ parts: ['ناوم ', 'ە.'], slots: ['name'] })
    expect(isTemplate(t('ناوم {name}ە.', 'nawim {name}e.'))).toBe(true)
    expect(isTemplate(t('ناوم ئاراسە.', 'nawim Arase.'))).toBe(false)
  })

  it('fills slots in script, Latin and translation', () => {
    const answer: QAAnswer = { text: 'ناوم {name}ە.', latin: 'nawim {name}e.', translation: { en: 'My name is {name}.', sv: 'Jag heter {name}.' } }
    const filled = fillAnswer(answer, { name: { text: 'ئێریک', latin: 'Êrîk', translation: { en: 'Erik', sv: 'Erik' } } })
    expect(filled).toEqual({ text: 'ناوم ئێریکە.', latin: 'nawim Êrîke.', translation: { en: 'My name is Erik.', sv: 'Jag heter Erik.' } })
    expect(fillAnswer(answer, { name: { text: '', latin: 'Erik' } }).text).toBe('ناوم Erikە.')
  })
})

describe('matchTemplate: Sorani', () => {
  const name = t('ناوم {name}ە.', 'nawim {name}e.')

  it('accepts any name in the slot, with the suffix attached', () => {
    expect(matchTemplate('ناوم ئێریکە.', name, 'ckb')).toBe('exact')
    expect(matchTemplate('ناوم ئێریکە', name, 'ckb')).toBe('exact')
    expect(matchTemplate('ناوم شیلانە', name, 'ckb')).toBe('exact')
  })

  it('accepts Latin input', () => {
    expect(matchTemplate('nawim Erike', name, 'ckb')).toBe('exact')
    expect(matchTemplate('Nawim Êrîke.', name, 'ckb')).toBe('exact')
    expect(matchTemplate('nawm erike', name, 'ckb')).toBe('typo')
  })

  it('treats spelling variants as close and one slip as a typo', () => {
    expect(matchTemplate('ناوم ئێریکه', name, 'ckb')).toBe('close')
    expect(matchTemplate('نوم ئێریکە', name, 'ckb')).toBe('typo')
  })

  it('does not forgive a wrong personal ending as a typo', () => {
    expect(matchTemplate('ناوت ئێریکە', name, 'ckb')).toBe('wrong')
    expect(matchTemplate('ناو ئێریکە', name, 'ckb')).toBe('wrong')
  })

  it('rejects a missing suffix, an empty slot or different fixed words', () => {
    expect(matchTemplate('nawim Erik', name, 'ckb')).toBe('wrong')
    expect(matchTemplate('ناومە', name, 'ckb')).toBe('wrong')
    expect(matchTemplate('ناوم', name, 'ckb')).toBe('wrong')
    expect(matchTemplate('خەڵکی سویدم', name, 'ckb')).toBe('wrong')
    expect(matchTemplate('', name, 'ckb')).toBe('wrong')
  })

  it('handles a slot at the start and numbers in the slot', () => {
    const age = t('{age} ساڵم.', '{age} sałim.')
    expect(matchTemplate('بیست ساڵم', age, 'ckb')).toBe('exact')
    expect(matchTemplate('٢٠ ساڵم', age, 'ckb')).toBe('exact')
    expect(matchTemplate('20 salim', age, 'ckb')).toBe('close')
    expect(matchTemplate('ساڵم', age, 'ckb')).toBe('wrong')
  })
})

describe('matchTemplate: Persian', () => {
  it('matches suffix slots and slots before a verb', () => {
    const esm = t('اسمم {name}ه.', 'esmam {name}e.')
    expect(matchTemplate('اسمم مریمه', esm, 'fa')).toBe('exact')
    expect(matchTemplate('اسمم مریمە', esm, 'fa')).toBe('exact')
    expect(matchTemplate('esmam Maryame', esm, 'fa')).toBe('exact')
    expect(matchTemplate('اسمم', esm, 'fa')).toBe('wrong')

    const hastam = t('{name} هستم.', '{name} hastam.')
    expect(matchTemplate('اریک هستم', hastam, 'fa')).toBe('exact')
    expect(matchTemplate('erik hastam', hastam, 'fa')).toBe('exact')
    expect(matchTemplate('اریک هستی', hastam, 'fa')).toBe('wrong')
  })

  it('accepts ezafe hyphens and ZWNJ variants in the fixed parts', () => {
    const ahl = t('اهل {place}م.', 'ahl-e {place}am.')
    expect(matchTemplate('اهل سوئدم', ahl, 'fa')).toBe('exact')
    expect(matchTemplate('ahl-e Su’edam', ahl, 'fa')).toBe('exact')
    expect(matchTemplate('ahle suedam', ahl, 'fa')).toBe('close')
    const speak = t('{language} صحبت می‌کنم.', '{language} sohbat mikonam.')
    expect(matchTemplate('سوئدی صحبت میکنم', speak, 'fa')).toBe('close')
  })

  it('keeps a bare slot template to a short answer', () => {
    const bare = t('{name}.', '{name}.')
    expect(matchTemplate('مریم', bare, 'fa')).toBe('exact')
    expect(matchTemplate('Maryam', bare, 'fa')).toBe('exact')
    expect(matchTemplate('من نمی‌دانم اسم مادرم چیست', bare, 'fa')).toBe('wrong')
  })
})

describe('captureSlots and displayValues', () => {
  it('captures what the learner put in the slot', () => {
    expect(captureSlots('ناوم ئێریکە.', t('ناوم {name}ە.', 'nawim {name}e.'), 'ckb')).toEqual({ name: { text: 'ئێریک', latin: '' } })
    expect(captureSlots('nawim erike', t('ناوم {name}ە.', 'nawim {name}e.'), 'ckb')).toEqual({ name: { text: '', latin: 'Erik' } })
    expect(captureSlots('من اهل مالمو هستم', t('من اهل {place}م.', 'man ahl-e {place}am.'), 'fa')).toBeNull()
  })

  it('uses examples the concrete answer does not already use, a different one per template', () => {
    const form = qaFor('ckb').find((q) => q.id === 'what-is-your-name')!.ckb!
    const first = displayValues(form, {}, 0).name!
    const second = displayValues(form, {}, 1).name!
    expect(form.answers[0].text).not.toContain(first.text)
    expect(first.text).not.toBe(second.text)
    expect(displayValues(form, { name: { text: 'ئێریک', latin: 'Êrîk' } }, 1).name).toEqual({ text: 'ئێریک', latin: 'Êrîk' })
  })
})

describe('matchQAAnswer', () => {
  const answers: QAAnswer[] = [t('اسم من آرش است.', 'esm-e man Arash ast.'), t('{name} هستم.', '{name} hastam.'), t('اسمم {name}ه.', 'esmam {name}e.')]

  it('picks the best matching answer and reports its index', () => {
    expect(matchQAAnswer('اسم من آرش است', answers, 'fa')).toEqual({ grade: 'exact', index: 0 })
    expect(matchQAAnswer('esm-e man Arash ast', answers, 'fa')).toEqual({ grade: 'exact', index: 0 })
    expect(matchQAAnswer('نیلوفر هستم', answers, 'fa')).toEqual({ grade: 'exact', index: 1 })
    expect(matchQAAnswer('اسمم نیلوفره', answers, 'fa')).toEqual({ grade: 'exact', index: 2 })
    expect(matchQAAnswer('خوشوقتم', answers, 'fa')).toEqual({ grade: 'wrong', index: -1 })
    expect(matchQAAnswer('   ', answers, 'fa')).toEqual({ grade: 'wrong', index: -1 })
  })
})
