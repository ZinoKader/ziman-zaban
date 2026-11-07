import { defineStrings } from '@/i18n'
import type { MedalTier } from './medals'

export const medalStrings = defineStrings({
  en: {
    hooray: 'Hooray!',
    learned: { ckb: (n: number) => `You've learned ${n} words in Sorani!`, fa: (n: number) => `You've learned ${n} words in Persian!` },
    learnedAll: {
      ckb: (n: number) => `You've learned all ${n} words in Sorani!`,
      fa: (n: number) => `You've learned all ${n} words in Persian!`,
    },
    earned: { bronze: 'You get a bronze medal.', silver: 'You get a silver medal.', gold: 'You get a gold medal.', star: 'You get the star medal.' } satisfies Record<MedalTier, string>,
    also: (n: number) => `Plus ${n === 1 ? '1 more medal' : `${n} more medals`} you had already earned.`,
    thanks: 'Thank you!',
    words: 'words',
    title: 'Medals',
    hint: 'A medal for every milestone of words learned. Medals stay, even if you forget a word later.',
    toGo: (n: number) => `${n} to go`,
    pending: 'Yours after your next session',
    next: (n: number, words: number) => `${n} ${n === 1 ? 'word' : 'words'} to your next medal (${words})`,
    medal: (words: number) => `Medal for ${words} words`,
    earnedOn: (date: string) => `Earned ${date}`,
  },
  sv: {
    hooray: 'Hurra!',
    learned: { ckb: (n: number) => `Du har lärt dig ${n} ord på sorani!`, fa: (n: number) => `Du har lärt dig ${n} ord på persiska!` },
    learnedAll: {
      ckb: (n: number) => `Du har lärt dig alla ${n} ord på sorani!`,
      fa: (n: number) => `Du har lärt dig alla ${n} ord på persiska!`,
    },
    earned: {
      bronze: 'Du får en bronsmedalj.',
      silver: 'Du får en silvermedalj.',
      gold: 'Du får en guldmedalj.',
      star: 'Du får stjärnmedaljen.',
    } satisfies Record<MedalTier, string>,
    also: (n: number) => `Och ${n === 1 ? '1 medalj till' : `${n} medaljer till`} som du redan hade förtjänat.`,
    thanks: 'Tack!',
    words: 'ord',
    title: 'Medaljer',
    hint: 'En medalj för varje milstolpe av inlärda ord. Medaljerna finns kvar även om du glömmer ett ord senare.',
    toGo: (n: number) => `${n} kvar`,
    pending: 'Din efter nästa pass',
    next: (n: number, words: number) => `${n} ord kvar till nästa medalj (${words})`,
    medal: (words: number) => `Medalj för ${words} ord`,
    earnedOn: (date: string) => `Fick den ${date}`,
  },
})
