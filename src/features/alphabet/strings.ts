import { defineStrings } from '@/i18n'
import type { CompareKey, PersianVowelRule, SameLetterKey, SoraniVowelRule } from './notes'

type Rule = { title: string; body: string }

export const alphabetStrings = defineStrings({
  en: {
    eyebrow: 'Alphabet',
    title: 'Reading the script',
    intro: {
      ckb: 'Sorani is written in the Arabic script, adapted so that almost every vowel gets its own letter. Learn these letters and you can sound out nearly any word you see.',
      fa: 'Persian uses the Arabic script plus four letters of its own (پ چ ژ گ). Short vowels are not written, so reading means learning the consonant outline of each word.',
    },
    showFor: 'Show the letters for',
    facts: {
      rtl: 'Right to left',
      rtlBody: 'Words and lines run from right to left. Numbers still run left to right.',
      join: 'Letters join up',
      joinBody: 'Most letters connect to the next one and change shape depending on where they sit.',
      count: (n: number) => `${n} letters`,
      countBody: {
        ckb: '33 letters, plus وو for the long û. No capital letters.',
        fa: '32 letters, plus آ for â at the start of a word. No capital letters.',
      },
      gaps: 'Some never join',
      gapsBody: 'These letters never connect to the letter after them, which leaves a small gap:',
    },
    anatomy: 'One word, letter by letter',
    anatomyBody: 'Read from the right. Notice how each letter changes shape to hold on to its neighbours.',
    letters: 'The letters',
    lettersHint: 'Tap a letter to see its shapes and hear it in a word.',
    filters: { all: 'All', vowels: 'Vowels', nonJoining: "Don't join", arabic: 'From Arabic' },
    legend: { vowel: 'vowel letter', nonJoining: 'never joins the next letter', arabic: 'mainly in Arabic loanwords' },
    detail: {
      name: 'Name',
      sound: 'Sound',
      ipa: 'IPA',
      silent: 'silent',
      shapes: 'Shapes',
      positions: { isolated: 'Alone', initial: 'Start', medial: 'Middle', final: 'End' },
      nonJoining: 'Never joins the letter after it, so it only has two shapes.',
      roles: {
        consonant: 'Consonant',
        vowel: 'Vowel',
        both: 'Consonant and vowel',
        seat: 'Vowel seat',
      },
      arabic: 'Mainly in words from Arabic',
      example: 'In a word',
      noExample: 'No course word uses this letter yet.',
      openWord: 'Open in Words',
      close: 'Close',
    },
    vowelsTitle: 'How vowels are written',
    vowels: {
      ckb: {
        unwritten: {
          title: 'Every vowel is written, except short i',
          body: 'Sorani spells vowels with letters, not marks. The one exception is the short i, which you hear but never see: ژن is jin.',
        },
        eh: {
          title: 'ە is the vowel e, ه is the consonant h',
          body: 'They look alike at the end of a word. The vowel ە never joins the next letter; the consonant ه always does.',
        },
        waw: {
          title: 'و is w or a short u, وو is a long û',
          body: 'One و is either a consonant or the short u. Two in a row always spell the long û.',
        },
        yeh: {
          title: 'ی is y or a long î, ێ is ê',
          body: 'A plain ی is a consonant or the long î. With the small v-mark below, ێ is always ê.',
        },
        seat: {
          title: 'A vowel never starts a word on its own',
          body: 'At the start of a word every vowel sits on the silent seat ئ. The romanization skips it.',
        },
      } satisfies Record<SoraniVowelRule, Rule>,
      fa: {
        unwritten: {
          title: 'Short vowels are left out',
          body: 'The short a, e and o are normally not written. من is man, and پدر (p-d-r) is pedar. You learn them with the word.',
        },
        alef: {
          title: 'ا is â, and آ starts a word with â',
          body: 'Inside a word ا is the long â. At the start, آ means â, while a bare ا carries a short vowel or comes before و and ی for a long u or i.',
        },
        vav: {
          title: 'و does four jobs',
          body: 'It can be the consonant v or the vowels u, o and ow. The romanization tells you which.',
        },
        yeh: {
          title: 'ی is y, i or ey',
          body: 'The same letter writes the consonant y, the long i and the diphthong ey.',
        },
        heh: {
          title: 'A final ه is often silent',
          body: 'At the end of a word, ه usually just marks a final vowel, mostly e (خاله khâle), sometimes a (نه na).',
        },
        zwnj: {
          title: 'The invisible half-space',
          body: 'Prefixes and suffixes like می and ها are joined with a zero-width non-joiner: they belong to the word but do not connect to it.',
        },
      } satisfies Record<PersianVowelRule, Rule>,
    },
    arabicTitle: 'Letters from Arabic',
    arabic: {
      ckb: 'Sorani spells words the way they sound, so even words borrowed from Arabic are written with Kurdish letters. The Arabic letters ث ذ ص ض ط ظ are normally not used at all: Arabic خط (line) becomes خەت xet. Only ع and ح are kept, and in Iraq they keep their Arabic throat sounds.',
      fa: 'Persian kept the spelling of its many Arabic loanwords, so several letters share one sound. When you hear s, it could be written three ways. The extra letters appear almost only in words from Arabic, so you learn the spelling with each word.',
      soundsLike: (latin: string) => `all sound like ${latin}`,
      inWords: 'In course words',
    },
    compareTitle: 'Sorani vs Persian',
    compareBody: 'The two alphabets are close cousins. These are the letters where they part ways.',
    compareCols: { letter: 'Letter', sorani: 'Sorani', persian: 'Persian' },
    compare: {
      e: { sorani: 'The vowel e', persian: 'Not used; e is unwritten or a final ه' },
      ee: { sorani: 'The vowel ê', persian: 'Not used; Persian has no ê' },
      o: { sorani: 'The vowel o', persian: 'Not used; o is unwritten or و' },
      ll: { sorani: 'The dark l', persian: 'Not used; only ل' },
      rr: { sorani: 'The rolled r', persian: 'Not used; only ر' },
      v: { sorani: 'v, a rare sound', persian: 'Not used; v is written و' },
      se: { sorani: 'Not used; written س', persian: 's, in Arabic loans' },
      zal: { sorani: 'Not used; written ز', persian: 'z, in Arabic loans' },
      sad: { sorani: 'Not used; written س', persian: 's, in Arabic loans' },
      zad: { sorani: 'Not used; written ز', persian: 'z, in Arabic loans' },
      ta: { sorani: 'Not used; written ت', persian: 't, in Arabic loans' },
      za: { sorani: 'Not used; written ز', persian: 'z, in Arabic loans' },
    } satisfies Record<CompareKey, { sorani: string; persian: string }>,
    sameLetterTitle: 'Same letter, different reading',
    sameLetter: {
      waw: 'Sorani w is Persian v.',
      qaf: 'A deep k in Sorani, a gargled gh in Tehran.',
      alef: 'Open a in Sorani, rounder â in Persian.',
      heh: 'Always h in Sorani; often a silent final e in Persian.',
      jim: 'The same sound, just romanized differently.',
    } satisfies Record<SameLetterKey, string>,
    quiz: {
      title: 'Quick letter quiz',
      body: 'Eight letters, four sounds each. No pressure, nothing is saved.',
      start: 'Start the quiz',
      prompt: 'What sound does this letter make?',
      progress: (n: number, total: number) => `${n} of ${total}`,
      streak: (n: number) => `${n} in a row`,
      correct: 'Yes!',
      wrong: (answer: string) => `It's ${answer}`,
      next: 'Next',
      result: (score: number, total: number) => `${score} of ${total} right`,
      verdict: (ratio: number): string =>
        ratio === 1
          ? 'Flawless. You can read these letters.'
          : ratio >= 0.75
            ? 'Great reading! A couple more rounds and they will stick.'
            : ratio >= 0.5
              ? 'Good start. Tap the ones you missed in the grid above.'
              : 'Every round helps. Have a look at the letters above and try again.',
      again: 'Play again',
    },
  },
  sv: {
    eyebrow: 'Alfabet',
    title: 'Att läsa skriften',
    intro: {
      ckb: 'Sorani skrivs med arabisk skrift, anpassad så att nästan varje vokal har en egen bokstav. Kan du de här bokstäverna kan du ljuda dig igenom nästan vilket ord som helst.',
      fa: 'Persiska skrivs med arabisk skrift och fyra egna bokstäver (پ چ ژ گ). Korta vokaler skrivs inte ut, så att läsa innebär att lära sig varje ords konsonantskelett.',
    },
    showFor: 'Visa bokstäverna för',
    facts: {
      rtl: 'Från höger till vänster',
      rtlBody: 'Ord och rader läses från höger till vänster. Siffror läses ändå från vänster till höger.',
      join: 'Bokstäverna binds ihop',
      joinBody: 'De flesta bokstäver hänger ihop med nästa och byter form beroende på var i ordet de står.',
      count: (n: number) => `${n} bokstäver`,
      countBody: {
        ckb: '33 bokstäver, plus وو för långt û. Inga versaler.',
        fa: '32 bokstäver, plus آ för â i början av ett ord. Inga versaler.',
      },
      gaps: 'Några binds aldrig',
      gapsBody: 'De här bokstäverna binds aldrig till bokstaven efter, så det blir ett litet mellanrum:',
    },
    anatomy: 'Ett ord, bokstav för bokstav',
    anatomyBody: 'Läs från höger. Se hur varje bokstav ändrar form för att hålla i sina grannar.',
    letters: 'Bokstäverna',
    lettersHint: 'Tryck på en bokstav för att se dess former och höra den i ett ord.',
    filters: { all: 'Alla', vowels: 'Vokaler', nonJoining: 'Binds inte', arabic: 'Från arabiskan' },
    legend: { vowel: 'vokalbokstav', nonJoining: 'binds aldrig till nästa bokstav', arabic: 'främst i arabiska lånord' },
    detail: {
      name: 'Namn',
      sound: 'Ljud',
      ipa: 'IPA',
      silent: 'stum',
      shapes: 'Former',
      positions: { isolated: 'Ensam', initial: 'Först', medial: 'Mitten', final: 'Sist' },
      nonJoining: 'Binds aldrig till bokstaven efter, så den har bara två former.',
      roles: {
        consonant: 'Konsonant',
        vowel: 'Vokal',
        both: 'Konsonant och vokal',
        seat: 'Vokalbärare',
      },
      arabic: 'Främst i ord från arabiskan',
      example: 'I ett ord',
      noExample: 'Inget ord i kursen använder den här bokstaven än.',
      openWord: 'Öppna i Ord',
      close: 'Stäng',
    },
    vowelsTitle: 'Så skrivs vokalerna',
    vowels: {
      ckb: {
        unwritten: {
          title: 'Alla vokaler skrivs, utom korta i',
          body: 'Sorani skriver vokaler med bokstäver, inte med tecken. Enda undantaget är korta i, som hörs men aldrig syns: ژن uttalas jin.',
        },
        eh: {
          title: 'ە är vokalen e, ه är konsonanten h',
          body: 'De ser likadana ut i slutet av ett ord. Vokalen ە binds aldrig till nästa bokstav, konsonanten ه gör det alltid.',
        },
        waw: {
          title: 'و är w eller kort u, وو är långt û',
          body: 'Ett و är antingen en konsonant eller ett kort u. Två i rad är alltid det långa û.',
        },
        yeh: {
          title: 'ی är j-ljud eller långt î, ێ är ê',
          body: 'Ett vanligt ی är en konsonant eller långt î. Med det lilla v-tecknet under är ێ alltid ê.',
        },
        seat: {
          title: 'En vokal står aldrig ensam först i ett ord',
          body: 'I början av ett ord sitter varje vokal på den stumma bäraren ئ. Den skrivs inte ut i transkriptionen.',
        },
      },
      fa: {
        unwritten: {
          title: 'Korta vokaler skrivs inte',
          body: 'Korta a, e och o skrivs normalt inte ut. من är man och پدر (p-d-r) är pedar. Vokalerna lär du dig med ordet.',
        },
        alef: {
          title: 'ا är â, och آ inleder ett ord med â',
          body: 'Inne i ett ord är ا ett långt â. I början betyder آ â, medan ett ensamt ا bär upp en kort vokal eller står före و och ی för ett långt u eller i.',
        },
        vav: {
          title: 'و har fyra uppgifter',
          body: 'Det kan vara konsonanten v eller vokalerna u, o och ow. Transkriptionen visar vilket.',
        },
        yeh: {
          title: 'ی är j-ljud, i eller ey',
          body: 'Samma bokstav skriver konsonanten j, det långa i och diftongen ey.',
        },
        heh: {
          title: 'Ett ه i slutet är ofta stumt',
          body: 'I slutet av ett ord visar ه oftast bara en slutvokal, för det mesta e (خاله khâle), ibland a (نه na).',
        },
        zwnj: {
          title: 'Det osynliga halvmellanslaget',
          body: 'Prefix och suffix som می och ها fogas till med en nollbreddsavgränsare: de hör till ordet men binds inte ihop med det.',
        },
      },
    },
    arabicTitle: 'Bokstäver från arabiskan',
    arabic: {
      ckb: 'Sorani stavar orden som de låter, så även lånord från arabiskan skrivs med kurdiska bokstäver. De arabiska bokstäverna ث ذ ص ض ط ظ används normalt inte alls: arabiskans خط (linje) blir خەت xet. Bara ع och ح finns kvar, och i Irak behåller de sina arabiska strupljud.',
      fa: 'Persiskan behöll stavningen i sina många arabiska lånord, så flera bokstäver delar på samma ljud. Hör du ett s kan det skrivas på tre sätt. Extrabokstäverna finns nästan bara i ord från arabiskan, så stavningen lär du dig med varje ord.',
      soundsLike: (latin: string) => `låter alla som ${latin}`,
      inWords: 'I kursens ord',
    },
    compareTitle: 'Sorani och persiska',
    compareBody: 'De två alfabeten är nära släkt. Här är bokstäverna där de skiljer sig åt.',
    compareCols: { letter: 'Bokstav', sorani: 'Sorani', persian: 'Persiska' },
    compare: {
      e: { sorani: 'Vokalen e', persian: 'Används inte; e skrivs inte ut eller som ه i slutet' },
      ee: { sorani: 'Vokalen ê', persian: 'Används inte; persiskan saknar ê' },
      o: { sorani: 'Vokalen o', persian: 'Används inte; o skrivs inte ut eller som و' },
      ll: { sorani: 'Det mörka l:et', persian: 'Används inte; bara ل' },
      rr: { sorani: 'Det rullande r:et', persian: 'Används inte; bara ر' },
      v: { sorani: 'v, ett ovanligt ljud', persian: 'Används inte; v skrivs و' },
      se: { sorani: 'Används inte; skrivs س', persian: 's, i arabiska lånord' },
      zal: { sorani: 'Används inte; skrivs ز', persian: 'z, i arabiska lånord' },
      sad: { sorani: 'Används inte; skrivs س', persian: 's, i arabiska lånord' },
      zad: { sorani: 'Används inte; skrivs ز', persian: 'z, i arabiska lånord' },
      ta: { sorani: 'Används inte; skrivs ت', persian: 't, i arabiska lånord' },
      za: { sorani: 'Används inte; skrivs ز', persian: 'z, i arabiska lånord' },
    },
    sameLetterTitle: 'Samma bokstav, olika uttal',
    sameLetter: {
      waw: 'Soranins w är persiskans v.',
      qaf: 'Ett djupt k på sorani, ett skrapande gh i Teheran.',
      alef: 'Öppet a på sorani, rundare â på persiska.',
      heh: 'Alltid h på sorani; ofta ett stumt slut-e på persiska.',
      jim: 'Samma ljud, bara olika transkription.',
    },
    quiz: {
      title: 'Snabbquiz',
      body: 'Åtta bokstäver, fyra ljud att välja på. Ingen press, inget sparas.',
      start: 'Starta quizet',
      prompt: 'Vilket ljud gör den här bokstaven?',
      progress: (n: number, total: number) => `${n} av ${total}`,
      streak: (n: number) => `${n} i rad`,
      correct: 'Ja!',
      wrong: (answer: string) => `Det är ${answer}`,
      next: 'Nästa',
      result: (score: number, total: number) => `${score} av ${total} rätt`,
      verdict: (ratio: number): string =>
        ratio === 1
          ? 'Felfritt. Du kan läsa de här bokstäverna.'
          : ratio >= 0.75
            ? 'Snyggt läst! Ett par rundor till så sitter de.'
            : ratio >= 0.5
              ? 'Bra början. Tryck på dem du missade i rutnätet ovanför.'
              : 'Varje runda hjälper. Titta på bokstäverna ovanför och försök igen.',
      again: 'Spela igen',
    },
  },
})
