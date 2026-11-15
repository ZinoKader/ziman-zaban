import { defineStrings } from '@/i18n'

export const picturesStrings = defineStrings({
  en: {
    newWord: 'New word',
    gotIt: 'Got it, test me',
    prompt: 'What do you see?',
    photo: (credit: string, license: string) => `Photo: ${credit}, ${license}`,
    noImage: 'The picture did not load.',
    youPicked: (meaning: string) => `The word you picked means "${meaning}".`,
  },
  sv: {
    newWord: 'Nytt ord',
    gotIt: 'Okej, testa mig',
    prompt: 'Vad ser du?',
    photo: (credit: string, license: string) => `Foto: ${credit}, ${license}`,
    noImage: 'Bilden gick inte att ladda.',
    youPicked: (meaning: string) => `Ordet du valde betyder "${meaning}".`,
  },
})
