import { defineStrings } from '@/i18n'
import type { LevelVerdict, Platform } from './diagnostics'
import type { MicError } from './mic'
import type { PromptGroup } from './prompts'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const studioStrings = defineStrings({
  en: {
    title: 'Record voices',
    intro:
      "Learners hear a computer voice for most words today. Record them in your own voice: read one word after another out loud. The app hears the pause after each word, keeps the recording and shows the next one. You don't press anything in between.",
    whoFor: 'For native speakers of Sorani Kurdish or Persian.',
    uiLang: 'Instructions in',
    langLabel: 'Language you record',
    nameLabel: 'Your name',
    namePlaceholder: 'e.g. Aras Ahmed',
    nameHint: 'Learners see it as the name of the voice.',
    consent: (license: string) => `My recordings may be used in Ziman·Zabân and shared under ${license}, with my name as credit.`,
    continue: 'Continue',
    save: 'Save',

    recordingAs: (name: string, lang: string) => `Recording ${lang} as ${name}`,
    change: 'Change',
    groupLabel: 'What to record',
    groups: { words: 'Words', sentences: 'Sentences and questions', all: 'Everything' } satisfies Record<PromptGroup, string>,
    left: (n: number, total: number) => `${n} of ${total} still need a voice`,
    allDone: 'Everything in this list has a voice. Pick another list.',
    startRecording: 'Start recording',
    tipsTitle: 'Before you start',
    tips: [
      'Find a quiet room and keep the microphone about 20 cm from your mouth.',
      'Say each text once, at normal speed, the way you would say it to a friend.',
      "Pause for about a second after each one. That's how the app knows you're done.",
      'Said it wrong? Press "Back" and say it again.',
      'Don\'t know a word, or does it look wrong? Press "Skip".',
    ],

    position: (i: number, n: number) => `${i} / ${n}`,
    status: { idle: 'Microphone off', starting: 'Starting the microphone', listening: 'Listening', hearing: 'Hearing you', paused: 'Paused', error: 'No microphone' },
    saved: 'Saved',
    back: 'Back',
    skip: 'Skip',
    pause: 'Pause',
    resume: 'Resume',
    done: 'Done',
    answerTo: (question: string) => `Answer to: ${question}`,
    upNext: 'Next',
    noisy: "It's noisy where you are. Recordings may be cut in the wrong place.",
    quiet: 'That was quiet. Move a little closer to the microphone.',
    loud: 'That was loud enough to distort. Move back a little.',
    finished: "That's the whole list. Thank you!",
    recordedNow: (n: number) => `${n} ${plural(n, 'recording', 'recordings')} this time`,
    micErrors: {
      unsupported: "This browser can't record.",
      insecure: 'The microphone only works on a secure (https) page.',
      denied: 'The browser blocked the microphone.',
      busy: 'Another app is using the microphone.',
      nodevice: 'No microphone was found.',
      blocked: "The browser didn't start the sound.",
      silent: 'The microphone is on, but no sound comes in.',
      failed: "The microphone didn't start.",
    } satisfies Record<MicError, string>,
    fixes: (code: MicError, platform: Platform, inApp: string | null): string[] => {
      const openInBrowser = inApp
        ? [
            `You opened the app inside ${inApp}. Its built-in browser often can't record.`,
            platform === 'ios' ? 'Open the menu (··· or the compass icon) and pick "Open in Safari".' : 'Open the menu (⋮) and pick "Open in Chrome" or "Open in browser".',
          ]
        : []
      const retry = 'Then tap "Try again".'
      switch (code) {
        case 'unsupported':
          return inApp ? openInBrowser : ["Use Safari on an iPhone, Chrome on Android, or Chrome, Edge, Firefox or Safari on a computer.", 'If the browser is old, update it.']
        case 'insecure':
          return ['Open the app at its address that starts with https://.']
        case 'denied':
          return [
            ...openInBrowser,
            ...(platform === 'ios'
              ? [
                  'In Safari: tap "aA" at the left of the address bar, then "Website Settings", and set Microphone to "Allow".',
                  'Not there, or still blocked? Open the Settings app, go to Apps > Safari > Microphone (on older iPhones Safari > Microphone) and pick "Ask" or "Allow".',
                  'In Chrome: open the Settings app, then Apps > Chrome, and turn on Microphone.',
                ]
              : platform === 'android'
                ? ['Tap the icon at the left of the address bar, then "Permissions", and turn on Microphone.']
                : ['Click the icon at the left of the address bar and allow the microphone for this site.']),
            retry,
          ]
        case 'busy':
          return [...openInBrowser, 'Another app is recording: a phone or FaceTime call, Voice Memos, dictation, or another tab. End or close it.', retry]
        case 'nodevice':
          return ['Connect a microphone, or check that your headset is plugged in.', retry]
        case 'blocked':
          return [
            ...openInBrowser,
            'Tap "Try again". The browser only starts sound after a tap.',
            ...(platform === 'ios' ? ['Still nothing? Close Safari completely (swipe it away in the app switcher), open the app again and test once more.'] : []),
          ]
        case 'silent':
          return [
            ...openInBrowser,
            'Disconnect Bluetooth headphones, or try another microphone.',
            'Reload the page and tap "Try again".',
            ...(platform === 'ios' ? ['Still nothing? Restart the iPhone. After a call iOS sometimes keeps the microphone busy.'] : []),
          ]
        case 'failed':
          return [...openInBrowser, 'Reload the page and tap "Try again".', 'Still nothing? Try another browser.']
      }
    },
    tryAgain: 'Try again',
    keys: 'Keys: Backspace goes back, → skips, Space pauses.',

    testMic: 'Test microphone',
    check: {
      title: 'Microphone check',
      intro: 'Check that the app hears you before you start. It takes about ten seconds.',
      start: 'Start the test',
      sayThis: 'Say this word, then pause:',
      steps: { browser: 'The browser can record', allowed: 'Microphone allowed', sound: 'Sound is coming in', voice: 'The app hears your voice', level: 'Volume' },
      waiting: 'Waiting for you to speak',
      noVoice: 'No voice yet. Speak a little louder and check that nothing covers the microphone.',
      noVoiceIos: 'On an iPhone the microphone is at the bottom edge, next to the charging port.',
      verdict: {
        good: 'Sounds good.',
        quiet: 'Quiet. Hold the microphone about 20 cm from your mouth.',
        loud: 'So loud that it distorts. Move back a little.',
        noisy: 'There is background noise. A quieter room gives cleaner recordings.',
      } satisfies Record<LevelVerdict, string>,
      inAppWarning: (app: string) => `Opened inside ${app}. If recording fails, open the app in Safari or Chrome.`,
      listen: 'Listen to yourself',
      again: 'Test again',
      ready: 'Start recording',
      passed: 'Everything works. You can start recording.',
      failedTitle: "The microphone doesn't work yet",
      howToFix: 'How to fix it',
      details: 'Technical details',
      copy: 'Copy details',
      copied: 'Copied',
      detailsHint: "Still not working? Copy the details and send them to the person who asked you to record.",
      close: 'Close',
    },

    reviewTitle: 'Your recordings',
    reviewHint: 'Listen to check that each recording matches its text. Delete the wrong ones and record them again.',
    count: (n: number) => `${n} ${plural(n, 'recording', 'recordings')} on this device`,
    none: 'Nothing recorded yet.',
    playAll: 'Listen to all',
    stop: 'Stop',
    play: (text: string) => `Play ${text}`,
    remove: (text: string) => `Delete ${text}`,
    exportTitle: 'Send your recordings',
    exportHint: 'Download the file and send it to the Ziman·Zabân team. Once it is added to the app, learners hear your voice for these texts.',
    download: (n: number) => `Download ${n} ${plural(n, 'recording', 'recordings')}`,
    downloaded: 'File downloaded',
    clear: 'Delete from this device',
    clearConfirm: "Delete all your recordings in this language from this device? Download them first if you haven't sent them.",
  },
  sv: {
    title: 'Spela in röster',
    intro:
      'I dag hör eleverna en datorröst för de flesta orden. Spela in dem med din egen röst: läs ord efter ord högt. Appen hör pausen efter varje ord, sparar inspelningen och visar nästa. Du behöver inte trycka på något mellan orden.',
    whoFor: 'För dig som har soranikurdiska eller persiska som modersmål.',
    uiLang: 'Instruktioner på',
    langLabel: 'Språk du spelar in',
    nameLabel: 'Ditt namn',
    namePlaceholder: 't.ex. Aras Ahmed',
    nameHint: 'Eleverna ser det som namnet på rösten.',
    consent: (license: string) => `Mina inspelningar får användas i Ziman·Zabân och delas under ${license}, med mitt namn angivet.`,
    continue: 'Fortsätt',
    save: 'Spara',

    recordingAs: (name: string, lang: string) => `Spelar in ${lang} som ${name}`,
    change: 'Ändra',
    groupLabel: 'Vad du spelar in',
    groups: { words: 'Ord', sentences: 'Meningar och frågor', all: 'Allt' } satisfies Record<PromptGroup, string>,
    left: (n: number, total: number) => `${n} av ${total} saknar fortfarande röst`,
    allDone: 'Allt i den här listan har en röst. Välj en annan lista.',
    startRecording: 'Börja spela in',
    tipsTitle: 'Innan du börjar',
    tips: [
      'Sitt i ett tyst rum och håll mikrofonen ungefär 20 cm från munnen.',
      'Säg varje text en gång, i vanlig takt, som du skulle säga den till en vän.',
      'Pausa ungefär en sekund efter varje. Då vet appen att du är klar.',
      'Blev det fel? Tryck på "Tillbaka" och säg det igen.',
      'Kan du inte ordet, eller ser det fel ut? Tryck på "Hoppa över".',
    ],

    position: (i: number, n: number) => `${i} / ${n}`,
    status: { idle: 'Mikrofonen är av', starting: 'Startar mikrofonen', listening: 'Lyssnar', hearing: 'Hör dig', paused: 'Pausad', error: 'Ingen mikrofon' },
    saved: 'Sparat',
    back: 'Tillbaka',
    skip: 'Hoppa över',
    pause: 'Pausa',
    resume: 'Fortsätt',
    done: 'Klar',
    answerTo: (question: string) => `Svar på: ${question}`,
    upNext: 'Nästa',
    noisy: 'Det är stökigt ljud omkring dig. Inspelningarna kan klippas på fel ställe.',
    quiet: 'Det var tyst. Gå lite närmare mikrofonen.',
    loud: 'Det var så högt att det kan låta förvrängt. Backa lite.',
    finished: 'Det var hela listan. Tack!',
    recordedNow: (n: number) => `${n} ${plural(n, 'inspelning', 'inspelningar')} den här gången`,
    micErrors: {
      unsupported: 'Den här webbläsaren kan inte spela in.',
      insecure: 'Mikrofonen fungerar bara på en säker sida (https).',
      denied: 'Webbläsaren blockerade mikrofonen.',
      busy: 'En annan app använder mikrofonen.',
      nodevice: 'Ingen mikrofon hittades.',
      blocked: 'Webbläsaren startade inte ljudet.',
      silent: 'Mikrofonen är på, men inget ljud kommer in.',
      failed: 'Mikrofonen startade inte.',
    } satisfies Record<MicError, string>,
    fixes: (code: MicError, platform: Platform, inApp: string | null): string[] => {
      const openInBrowser = inApp
        ? [
            `Du har öppnat appen inne i ${inApp}. Dess inbyggda webbläsare kan ofta inte spela in.`,
            platform === 'ios' ? 'Öppna menyn (··· eller kompassikonen) och välj "Öppna i Safari".' : 'Öppna menyn (⋮) och välj "Öppna i Chrome" eller "Öppna i webbläsare".',
          ]
        : []
      const retry = 'Tryck sedan på "Försök igen".'
      switch (code) {
        case 'unsupported':
          return inApp ? openInBrowser : ['Använd Safari på iPhone, Chrome på Android, eller Chrome, Edge, Firefox eller Safari på en dator.', 'Uppdatera webbläsaren om den är gammal.']
        case 'insecure':
          return ['Öppna appen på adressen som börjar med https://.']
        case 'denied':
          return [
            ...openInBrowser,
            ...(platform === 'ios'
              ? [
                  'I Safari: tryck på "aA" till vänster i adressfältet, sedan "Webbplatsinställningar", och ställ Mikrofon på "Tillåt".',
                  'Finns det inte där, eller är den fortfarande blockerad? Öppna appen Inställningar, gå till Appar > Safari > Mikrofon (på äldre iPhone Safari > Mikrofon) och välj "Fråga" eller "Tillåt".',
                  'I Chrome: öppna appen Inställningar, sedan Appar > Chrome, och slå på Mikrofon.',
                ]
              : platform === 'android'
                ? ['Tryck på ikonen till vänster i adressfältet, sedan "Behörigheter", och slå på Mikrofon.']
                : ['Klicka på ikonen till vänster i adressfältet och tillåt mikrofonen för den här webbplatsen.']),
            retry,
          ]
        case 'busy':
          return [...openInBrowser, 'En annan app spelar in: ett telefon- eller FaceTime-samtal, Röstmemon, diktering eller en annan flik. Avsluta eller stäng den.', retry]
        case 'nodevice':
          return ['Anslut en mikrofon, eller kolla att headsetet sitter i.', retry]
        case 'blocked':
          return [
            ...openInBrowser,
            'Tryck på "Försök igen". Webbläsaren startar bara ljud efter ett tryck.',
            ...(platform === 'ios' ? ['Fortfarande inget? Stäng Safari helt (svep bort den i appväxlaren), öppna appen igen och testa en gång till.'] : []),
          ]
        case 'silent':
          return [
            ...openInBrowser,
            'Koppla från Bluetooth-hörlurar, eller prova en annan mikrofon.',
            'Ladda om sidan och tryck på "Försök igen".',
            ...(platform === 'ios' ? ['Fortfarande inget? Starta om din iPhone. Efter ett samtal håller iOS ibland kvar mikrofonen.'] : []),
          ]
        case 'failed':
          return [...openInBrowser, 'Ladda om sidan och tryck på "Försök igen".', 'Fortfarande inget? Prova en annan webbläsare.']
      }
    },
    tryAgain: 'Försök igen',
    keys: 'Tangenter: Backsteg går tillbaka, → hoppar över, Mellanslag pausar.',

    testMic: 'Testa mikrofonen',
    check: {
      title: 'Mikrofontest',
      intro: 'Kolla att appen hör dig innan du börjar. Det tar ungefär tio sekunder.',
      start: 'Starta testet',
      sayThis: 'Säg det här ordet och pausa sedan:',
      steps: { browser: 'Webbläsaren kan spela in', allowed: 'Mikrofonen är tillåten', sound: 'Ljud kommer in', voice: 'Appen hör din röst', level: 'Ljudnivå' },
      waiting: 'Väntar på att du ska prata',
      noVoice: 'Ingen röst än. Prata lite högre och kolla att inget täcker mikrofonen.',
      noVoiceIos: 'På en iPhone sitter mikrofonen på nederkanten, bredvid laddkontakten.',
      verdict: {
        good: 'Låter bra.',
        quiet: 'Tyst. Håll mikrofonen ungefär 20 cm från munnen.',
        loud: 'Så högt att det låter förvrängt. Backa lite.',
        noisy: 'Det hörs bakgrundsljud. Ett tystare rum ger renare inspelningar.',
      } satisfies Record<LevelVerdict, string>,
      inAppWarning: (app: string) => `Öppnad inne i ${app}. Om inspelningen inte fungerar, öppna appen i Safari eller Chrome.`,
      listen: 'Lyssna på dig själv',
      again: 'Testa igen',
      ready: 'Börja spela in',
      passed: 'Allt fungerar. Du kan börja spela in.',
      failedTitle: 'Mikrofonen fungerar inte än',
      howToFix: 'Så löser du det',
      details: 'Tekniska detaljer',
      copy: 'Kopiera detaljerna',
      copied: 'Kopierat',
      detailsHint: 'Fungerar det fortfarande inte? Kopiera detaljerna och skicka dem till den som bad dig spela in.',
      close: 'Stäng',
    },

    reviewTitle: 'Dina inspelningar',
    reviewHint: 'Lyssna och kolla att varje inspelning stämmer med texten. Ta bort de som blev fel och spela in dem igen.',
    count: (n: number) => `${n} ${plural(n, 'inspelning', 'inspelningar')} på den här enheten`,
    none: 'Inget inspelat än.',
    playAll: 'Lyssna på alla',
    stop: 'Stoppa',
    play: (text: string) => `Spela upp ${text}`,
    remove: (text: string) => `Ta bort ${text}`,
    exportTitle: 'Skicka dina inspelningar',
    exportHint: 'Ladda ner filen och skicka den till Ziman·Zabân. När den har lagts in i appen hör eleverna din röst för de här texterna.',
    download: (n: number) => `Ladda ner ${n} ${plural(n, 'inspelning', 'inspelningar')}`,
    downloaded: 'Filen har laddats ner',
    clear: 'Ta bort från enheten',
    clearConfirm: 'Ta bort alla dina inspelningar på det här språket från enheten? Ladda ner dem först om du inte har skickat dem.',
  },
})
