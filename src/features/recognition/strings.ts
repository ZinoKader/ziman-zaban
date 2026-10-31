import { defineStrings } from '@/i18n'

export const recognitionStrings = defineStrings({
  en: {
    newWord: 'New word',
    gotIt: 'Got it, test me',
    whatMeans: 'What does this mean?',
    listenPrompt: 'Listen. What does it mean?',
    playAgain: 'Play again',
    typeMeaning: 'Type the meaning in English or Swedish',
    dontKnow: "I don't know",
    youChose: 'You chose',
    example: 'Example',
    why: 'Seeing a word and recalling its meaning builds understanding. Words you get right come back less often; words you miss come back sooner.',
  },
  sv: {
    newWord: 'Nytt ord',
    gotIt: 'Jag förstår, testa mig',
    whatMeans: 'Vad betyder det här?',
    listenPrompt: 'Lyssna. Vad betyder det?',
    playAgain: 'Spela igen',
    typeMeaning: 'Skriv betydelsen på svenska eller engelska',
    dontKnow: 'Jag vet inte',
    youChose: 'Du valde',
    example: 'Exempel',
    why: 'Att se ett ord och plocka fram betydelsen bygger förståelse. Ord du kan kommer tillbaka mer sällan; ord du missar kommer tillbaka snabbare.',
  },
})
