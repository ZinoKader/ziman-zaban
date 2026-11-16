import { defineStrings } from '@/i18n'

export const homeStrings = defineStrings({
  en: {
    hello: { ckb: 'سڵاو', fa: 'سلام' },
    path: 'From words to conversation',
    continue: 'Continue',
    start: 'Start your first session',
    step: (n: number) => `Step ${n}`,
    locked: 'Opens as you learn words',
    allDone: "You're all caught up. Come back later for reviews.",
    more: 'More practice',
  },
  sv: {
    hello: { ckb: 'سڵاو', fa: 'سلام' },
    path: 'Från ord till samtal',
    continue: 'Fortsätt',
    start: 'Starta ditt första pass',
    step: (n: number) => `Steg ${n}`,
    locked: 'Låses upp när du lär dig ord',
    allDone: 'Du är ikapp. Kom tillbaka senare och repetera.',
    more: 'Mer att öva på',
  },
})
