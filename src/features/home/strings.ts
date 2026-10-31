import { defineStrings } from '@/i18n'

export const homeStrings = defineStrings({
  en: {
    hello: { ckb: 'سڵاو', fa: 'سلام' },
    path: 'From words to conversation',
    pathHint: 'Each step unlocks as you master the one before it.',
    continue: 'Continue',
    start: 'Start your first session',
    step: (n: number) => `Step ${n}`,
    locked: 'Unlocks as you learn words',
    allDone: "You're all caught up. Come back later for reviews.",
  },
  sv: {
    hello: { ckb: 'سڵاو', fa: 'سلام' },
    path: 'Från ord till samtal',
    pathHint: 'Varje steg låses upp när du behärskar det föregående.',
    continue: 'Fortsätt',
    start: 'Starta ditt första pass',
    step: (n: number) => `Steg ${n}`,
    locked: 'Låses upp när du lär dig ord',
    allDone: 'Du är i fas. Kom tillbaka senare för repetitioner.',
  },
})
