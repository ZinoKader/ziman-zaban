import { defineStrings } from '@/i18n'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const sessionStrings = defineStrings({
  en: {
    keepGoing: {
      recognition: 'How about a few new words?',
      recall: 'How about a few more words?',
      construction: 'How about a few new sentences?',
      response: 'How about a few new questions?',
    },
    learnNew: {
      recognition: (n: number) => `Learn ${n} new ${plural(n, 'word', 'words')}`,
      recall: (n: number) => `Practise ${n} new ${plural(n, 'word', 'words')}`,
      construction: (n: number) => `Build ${n} new ${plural(n, 'sentence', 'sentences')}`,
      response: (n: number) => `Try ${n} new ${plural(n, 'question', 'questions')}`,
    },
    ready: {
      recognition: (n: number) => `${n} new ${plural(n, 'word is', 'words are')} ready in Recognition.`,
      recall: (n: number) => `${n} ${plural(n, 'word is', 'words are')} ready to practise in Recall.`,
      construction: (n: number) => `${n} new ${plural(n, 'sentence is', 'sentences are')} ready in Sentence building.`,
      response: (n: number) => `${n} new ${plural(n, 'question is', 'questions are')} ready in Q&A.`,
    },
    reviewMore: (n: number) => `Review ${n} more`,
    continueWith: (module: string) => `Continue: ${module}`,
    caughtUp: "You're all caught up. Come back later for reviews.",
    noReviews: 'Nothing to review right now. How about a few new words?',
  },
  sv: {
    keepGoing: {
      recognition: 'Ska du lära dig några nya ord?',
      recall: 'Ska du öva på några ord till?',
      construction: 'Ska du bygga några nya meningar?',
      response: 'Ska du ta några nya frågor?',
    },
    learnNew: {
      recognition: (n: number) => `Lär dig ${n} ${plural(n, 'nytt', 'nya')} ord`,
      recall: (n: number) => `Öva på ${n} ${plural(n, 'nytt', 'nya')} ord`,
      construction: (n: number) => `Bygg ${n} ${plural(n, 'ny mening', 'nya meningar')}`,
      response: (n: number) => `Ta ${n} ${plural(n, 'ny fråga', 'nya frågor')}`,
    },
    ready: {
      recognition: (n: number) => `${n} ${plural(n, 'nytt', 'nya')} ord väntar i Igenkänning.`,
      recall: (n: number) => `${n} ord väntar på att övas i Återkallning.`,
      construction: (n: number) => `${n} ${plural(n, 'ny mening väntar', 'nya meningar väntar')} i Meningsbygge.`,
      response: (n: number) => `${n} ${plural(n, 'ny fråga väntar', 'nya frågor väntar')} i Frågor & svar.`,
    },
    reviewMore: (n: number) => `Repetera ${n} till`,
    continueWith: (module: string) => `Fortsätt: ${module}`,
    caughtUp: 'Du är i fas. Kom tillbaka senare för repetitioner.',
    noReviews: 'Inget att repetera just nu. Ska du lära dig några nya ord?',
  },
})
