import type { Localized, TargetLang } from '@/content/types'

/**
 * `seat` is Sorani ئ: silent itself, it carries a vowel at the start of a word.
 * `both` letters are consonants that also write vowels (و, ی).
 */
export type LetterRole = 'consonant' | 'vowel' | 'both' | 'seat'

export interface Letter {
  /** The letter (or Sorani digraph وو) in its isolated form. */
  char: string
  /** Traditional letter name in the course romanization. */
  name: string
  /** Romanization values per docs/CONTENT_GUIDE.md, most common first. Empty when silent. */
  latin: string[]
  /** IPA, one per romanization value (or one for a silent letter). */
  ipa: string[]
  hint: Localized
  /** False for letters that never join the letter after them. */
  joinsLeft: boolean
  role: LetterRole
  /** Found (almost) only in words borrowed from Arabic. */
  arabic?: boolean
  note?: Localized
}

const l = (
  char: string,
  name: string,
  latin: string[],
  ipa: string[],
  en: string,
  sv: string,
  extra: Partial<Letter> = {},
): Letter => ({ char, name, latin, ipa, hint: { en, sv }, joinsLeft: true, role: 'consonant', ...extra })

const nonJoining = { joinsLeft: false }

/*
 * Sources: W. M. Thackston, Sorani Kurdish: A Reference Grammar (phonology and writing system),
 * R. Ishida, Arabic (Sorani) orthography notes (r12a), and docs/CONTENT_GUIDE.md for romanization.
 */
export const SORANI_LETTERS: Letter[] = [
  l('ئ', 'hemze', [], ['ʔ'], 'Silent: a seat for a vowel at the start of a word', 'Stum: bär upp en vokal i början av ett ord', {
    role: 'seat',
    note: {
      en: 'Every word that starts with a vowel starts with ئ: ئاو aw (water), ئێوە êwe (you all). It is not written in the romanization.',
      sv: 'Varje ord som börjar på vokal börjar med ئ: ئاو aw (vatten), ئێوە êwe (ni). Den skrivs inte ut i transkriptionen.',
    },
  }),
  l('ا', 'elîf', ['a'], ['ɑː'], 'a as in father', 'a som i glas', {
    ...nonJoining,
    role: 'vowel',
    note: {
      en: 'Always the long a. At the start of a word it sits on a seat: ئا.',
      sv: 'Alltid det långa a-ljudet. I början av ett ord sitter det på en bärare: ئا.',
    },
  }),
  l('ب', 'bê', ['b'], ['b'], 'b as in boy', 'b som i bok'),
  l('پ', 'pê', ['p'], ['p'], 'p as in pen', 'p som i penna'),
  l('ت', 'tê', ['t'], ['t'], 't as in top', 't som i tak'),
  l('ج', 'cîm', ['c'], ['d͡ʒ'], 'j as in jam', 'som j i engelska jam (ett tonande dj-ljud)', {
    note: {
      en: 'Written c in Kurdish Latin, but it sounds like English j.',
      sv: 'Skrivs c med latinska bokstäver men låter som engelskt j.',
    },
  }),
  l('چ', 'çîm', ['ç'], ['t͡ʃ'], 'ch as in church', 'som ch i engelska church (ett tj-ljud med t)'),
  l('ح', 'ḧê', ['ḧ'], ['ħ'], 'a breathy h squeezed from the throat', 'ett pressat h långt bak i halsen', {
    note: {
      en: 'Common in Iraqi Kurdistan, as in حەوت ḧewt (seven). Many speakers in Iran say a plain h instead.',
      sv: 'Vanligt i irakiska Kurdistan, som i حەوت ḧewt (sju). Många talare i Iran säger ett vanligt h i stället.',
    },
  }),
  l('خ', 'xê', ['x'], ['x'], 'ch as in Scottish loch or German Bach', 'som ch i tyska Bach, ett raspigt h'),
  l('د', 'dal', ['d'], ['d'], 'd as in day', 'd som i dag', nonJoining),
  l('ر', 'rê', ['r'], ['ɾ'], 'a single quick tap, like tt in American better', 'ett lätt r med ett enda tungslag', {
    ...nonJoining,
    note: {
      en: 'Never at the start of a word: a word-initial r is always the rolled ڕ.',
      sv: 'Står aldrig först i ett ord: ett r i början av ett ord är alltid det rullande ڕ.',
    },
  }),
  l('ڕ', 'řê', ['ř'], ['r'], 'a rolled r, as in Spanish perro', 'ett rullande r, som i spanska perro', {
    ...nonJoining,
    note: {
      en: 'The small v-mark makes the r rolled. It changes meaning: کەر ker (donkey) but کەڕ keř (deaf).',
      sv: 'Det lilla v-tecknet gör r:et rullande. Det ändrar betydelsen: کەر ker (åsna) men کەڕ keř (döv).',
    },
  }),
  l('ز', 'zê', ['z'], ['z'], 'z as in zoo', 'tonande s, som z i engelska zoo', nonJoining),
  l('ژ', 'jê', ['j'], ['ʒ'], 's as in measure', 'som s i engelska measure eller j i franska jour', {
    ...nonJoining,
    note: {
      en: 'Written j in Kurdish Latin: ژن jin (woman).',
      sv: 'Skrivs j med latinska bokstäver: ژن jin (kvinna).',
    },
  }),
  l('س', 'sîn', ['s'], ['s'], 's as in sun', 's som i sol'),
  l('ش', 'şîn', ['ş'], ['ʃ'], 'sh as in ship', 'som sh i engelska ship, nära rs i fors'),
  l('ع', "'eyn", ["'"], ['ʕ'], 'a tight squeeze deep in the throat', 'ett pressat ljud djupt nere i strupen', {
    arabic: true,
    note: {
      en: 'Kept in words from Arabic. In Iraq it is said as in Arabic; in Iran it is often a short stop or a longer vowel.',
      sv: 'Finns kvar i ord från arabiskan. I Irak uttalas den som på arabiska; i Iran blir den ofta ett kort stopp eller en längre vokal.',
    },
  }),
  l('غ', 'ẍeyn', ['ẍ'], ['ɣ'], 'a gargled sound, like a French r', 'ett skrapande ljud, som ett skorrande r', {
    note: {
      en: 'Rare at the start of a word.',
      sv: 'Ovanlig i början av ett ord.',
    },
  }),
  l('ف', 'fê', ['f'], ['f'], 'f as in fish', 'f som i fisk'),
  l('ڤ', 'vê', ['v'], ['v'], 'v as in very', 'v som i vatten', {
    note: {
      en: 'A rare sound in Sorani; you will meet it more in Kurmanji Kurdish.',
      sv: 'Ett ovanligt ljud på sorani; det är vanligare på kurmanji.',
    },
  }),
  l('ق', 'qaf', ['q'], ['q'], 'a k made far back, at the uvula', 'ett k längst bak i munnen, vid tungspenen'),
  l('ک', 'kaf', ['k'], ['k'], 'k as in kite', 'k som i kaka'),
  l('گ', 'gaf', ['g'], ['ɡ'], 'g as in go', 'g som i gå'),
  l('ل', 'lam', ['l'], ['l'], 'a light l, as in leaf', 'ett ljust l, som i lampa'),
  l('ڵ', 'lamî qelew', ['ł'], ['ɫ'], 'a dark l, as in English full', 'ett mörkt l, som ll i engelska full', {
    note: {
      en: 'The "fat l". Never at the start of a word, and it changes meaning: گوڵ guł (flower) but گول gul (leper).',
      sv: '"Det feta l:et". Står aldrig först i ett ord och ändrar betydelsen: گوڵ guł (blomma) men گول gul (spetälsk).',
    },
  }),
  l('م', 'mîm', ['m'], ['m'], 'm as in moon', 'm som i mamma'),
  l('ن', 'nûn', ['n'], ['n'], 'n as in no', 'n som i natt'),
  l('و', 'waw', ['w', 'u'], ['w', 'ʊ'], 'w as in water, or u as in put', 'w som i engelska water, eller u som o i ost', {
    ...nonJoining,
    role: 'both',
    note: {
      en: 'A consonant (وڵات wiłat, country) or the short vowel u (کوڕ kuř, son). Doubled, وو is the long û.',
      sv: 'En konsonant (وڵات wiłat, land) eller den korta vokalen u (کوڕ kuř, son). Dubbelt, وو, blir det långa û.',
    },
  }),
  l('ۆ', 'o', ['o'], ['o'], 'o as in go, but pure, without the w-glide', 'som å i gå', {
    ...nonJoining,
    role: 'vowel',
    note: {
      en: 'و with a small v-mark on top. Always the vowel o: تۆ to (you).',
      sv: 'و med ett litet v-tecken ovanpå. Alltid vokalen o: تۆ to (du).',
    },
  }),
  l('ه', 'hê', ['h'], ['h'], 'h as in hat', 'h som i hus', {
    note: {
      en: 'Only ever the consonant h. Do not confuse it with ە, the vowel e.',
      sv: 'Alltid konsonanten h. Blanda inte ihop den med ە, vokalen e.',
    },
  }),
  l('ە', 'e', ['e'], ['æ'], 'a as in cat', 'som ä i ärta', {
    ...nonJoining,
    role: 'vowel',
    note: {
      en: 'The vowel e. It looks like a final ه, but it never joins the next letter: هەبوون hebûn (to have) has both.',
      sv: 'Vokalen e. Den liknar ett ه i slutet av ett ord men binds aldrig till nästa bokstav: هەبوون hebûn (att ha) har båda.',
    },
  }),
  l('ی', 'yê', ['y', 'î'], ['j', 'iː'], 'y as in yes, or ee as in see', 'j som i ja, eller i som i bil', {
    role: 'both',
    note: {
      en: 'A consonant y or the long vowel î: چی çî (what).',
      sv: 'En konsonant (j-ljud) eller det långa î: چی çî (vad).',
    },
  }),
  l('ێ', 'ê', ['ê'], ['e'], 'like ai in bait, without the glide', 'som e i veta', {
    role: 'vowel',
    note: {
      en: 'ی with a small v-mark below. Always the vowel ê: کێ kê (who).',
      sv: 'ی med ett litet v-tecken under. Alltid vokalen ê: کێ kê (vem).',
    },
  }),
  l('وو', 'û', ['û'], ['uː'], 'oo as in food', 'som o i bo', {
    ...nonJoining,
    role: 'vowel',
    note: {
      en: 'Not a separate letter but two و in a row, which spell the long û: پوور pûr (aunt).',
      sv: 'Ingen egen bokstav utan två و i rad, som skriver det långa û: پوور pûr (faster, moster).',
    },
  }),
]

/* Persian: Tehrani pronunciation, learner romanization from docs/CONTENT_GUIDE.md. */
export const PERSIAN_LETTERS: Letter[] = [
  l('ا', 'alef', ['â'], ['ɒː'], 'â: an a with rounded lips, between father and law', 'â: ett a med rundade läppar, mellan a i glas och å i gå', {
    ...nonJoining,
    role: 'vowel',
    note: {
      en: 'Inside a word it is the long â. At the start of a word it carries a short vowel: اسم esm (name), او u (he, she).',
      sv: 'Inne i ett ord är det långt â. I början av ett ord bär det upp en kort vokal: اسم esm (namn), او u (han, hon).',
    },
  }),
  l('آ', 'alef madde', ['â'], ['ɒː'], 'â at the start of a word', 'â i början av ett ord', {
    ...nonJoining,
    role: 'vowel',
    note: {
      en: 'Alef with a wavy madde on top writes â at the start of a word: آن ân (that).',
      sv: 'Alef med ett vågigt madde-tecken skriver â i början av ett ord: آن ân (den där).',
    },
  }),
  l('ب', 'be', ['b'], ['b'], 'b as in boy', 'b som i bok'),
  l('پ', 'pe', ['p'], ['p'], 'p as in pen', 'p som i penna'),
  l('ت', 'te', ['t'], ['t'], 't as in top', 't som i tak'),
  l('ث', 'se', ['s'], ['s'], 's as in sun', 's som i sol', {
    arabic: true,
    note: { en: 'Sounds exactly like س.', sv: 'Låter precis som س.' },
  }),
  l('ج', 'jim', ['j'], ['d͡ʒ'], 'j as in jam', 'som j i engelska jam (ett tonande dj-ljud)'),
  l('چ', 'che', ['ch'], ['t͡ʃ'], 'ch as in church', 'som ch i engelska church (ett tj-ljud med t)'),
  l('ح', 'he-ye jimi', ['h'], ['h'], 'h as in hat', 'h som i hus', {
    arabic: true,
    note: { en: 'Sounds exactly like ه: صبح sobh (morning).', sv: 'Låter precis som ه: صبح sobh (morgon).' },
  }),
  l('خ', 'khe', ['kh'], ['x'], 'ch as in Scottish loch or German Bach', 'som ch i tyska Bach, ett raspigt h'),
  l('د', 'dâl', ['d'], ['d'], 'd as in day', 'd som i dag', nonJoining),
  l('ذ', 'zâl', ['z'], ['z'], 'z as in zoo', 'tonande s, som z i engelska zoo', {
    ...nonJoining,
    arabic: true,
    note: { en: 'Sounds exactly like ز.', sv: 'Låter precis som ز.' },
  }),
  l('ر', 're', ['r'], ['ɾ'], 'a single quick tap, like tt in American better', 'ett lätt r med ett enda tungslag', nonJoining),
  l('ز', 'ze', ['z'], ['z'], 'z as in zoo', 'tonande s, som z i engelska zoo', nonJoining),
  l('ژ', 'zhe', ['zh'], ['ʒ'], 's as in measure', 'som s i engelska measure eller j i franska jour', {
    ...nonJoining,
    note: { en: 'Rare: a few Persian words and many French loans.', sv: 'Ovanlig: några persiska ord och många franska lånord.' },
  }),
  l('س', 'sin', ['s'], ['s'], 's as in sun', 's som i sol'),
  l('ش', 'shin', ['sh'], ['ʃ'], 'sh as in ship', 'som sh i engelska ship, nära rs i fors'),
  l('ص', 'sâd', ['s'], ['s'], 's as in sun', 's som i sol', {
    arabic: true,
    note: { en: 'Sounds exactly like س.', sv: 'Låter precis som س.' },
  }),
  l('ض', 'zâd', ['z'], ['z'], 'z as in zoo', 'tonande s, som z i engelska zoo', {
    arabic: true,
    note: { en: 'Sounds exactly like ز.', sv: 'Låter precis som ز.' },
  }),
  l('ط', 'tâ', ['t'], ['t'], 't as in top', 't som i tak', {
    arabic: true,
    note: { en: 'Sounds exactly like ت: لطفاً lotfan (please).', sv: 'Låter precis som ت: لطفاً lotfan (snälla).' },
  }),
  l('ظ', 'zâ', ['z'], ['z'], 'z as in zoo', 'tonande s, som z i engelska zoo', {
    arabic: true,
    note: { en: 'Sounds exactly like ز: خداحافظ khodâhâfez (goodbye).', sv: 'Låter precis som ز: خداحافظ khodâhâfez (hej då).' },
  }),
  l('ع', "'eyn", ["'"], ['ʔ'], 'a catch in the throat, as in uh-oh; often just a pause', 'ett kort stopp i strupen, som i engelska uh-oh; ofta bara en paus', {
    arabic: true,
    note: {
      en: 'At the start of a word it is barely heard and not romanized: عمو amu (uncle).',
      sv: 'I början av ett ord hörs den knappt och skrivs inte ut: عمو amu (farbror).',
    },
  }),
  l('غ', 'gheyn', ['gh'], ['ɢ ~ ɣ'], 'a gargled g, like a French r', 'ett skrapande g, likt ett skorrande r', {
    note: { en: 'In Tehran, غ and ق sound the same.', sv: 'I Teheran låter غ och ق likadant.' },
  }),
  l('ف', 'fe', ['f'], ['f'], 'f as in fish', 'f som i fisk'),
  l('ق', 'ghâf', ['gh'], ['ɢ ~ ɣ'], 'a gargled g, like a French r', 'ett skrapande g, likt ett skorrande r', {
    note: { en: 'In Tehran, ق and غ sound the same: فقط faghat (only).', sv: 'I Teheran låter ق och غ likadant: فقط faghat (bara).' },
  }),
  l('ک', 'kâf', ['k'], ['k'], 'k as in kite', 'k som i kaka'),
  l('گ', 'gâf', ['g'], ['ɡ'], 'g as in go', 'g som i gå'),
  l('ل', 'lâm', ['l'], ['l'], 'a light l, as in leaf', 'ett ljust l, som i lampa'),
  l('م', 'mim', ['m'], ['m'], 'm as in moon', 'm som i mamma'),
  l('ن', 'nun', ['n'], ['n'], 'n as in no', 'n som i natt'),
  l('و', 'vâv', ['v', 'u', 'o', 'ow'], ['v', 'uː', 'o', 'ow'], 'v as in very, or the vowels u, o, ow', 'v som i vatten, eller vokalerna u, o, ow', {
    ...nonJoining,
    role: 'both',
    note: {
      en: 'Four jobs: کشور keshvar (country), دوست dust (friend), تو to (you), نوزاد nowzâd (baby).',
      sv: 'Fyra uppgifter: کشور keshvar (land), دوست dust (vän), تو to (du), نوزاد nowzâd (spädbarn).',
    },
  }),
  l('ه', 'he-ye do-cheshm', ['h', 'e'], ['h', 'e'], 'h as in hat; silent at the end of many words', 'h som i hus; stum i slutet av många ord', {
    note: {
      en: 'At the end of a word it is often silent and only marks a final e: خاله khâle (aunt).',
      sv: 'I slutet av ett ord är den ofta stum och visar bara ett slut-e: خاله khâle (moster).',
    },
  }),
  l('ی', 'ye', ['y', 'i', 'ey'], ['j', 'iː', 'ej'], 'y as in yes, or ee as in see', 'j som i ja, eller i som i bil', {
    role: 'both',
    note: {
      en: 'A consonant y, the long vowel i, or ey: خیلی kheyli (very) has two of them.',
      sv: 'En konsonant (j-ljud), det långa i eller ey: خیلی kheyli (mycket) har två av dem.',
    },
  }),
]

export const LETTERS: Record<TargetLang, Letter[]> = { ckb: SORANI_LETTERS, fa: PERSIAN_LETTERS }

export function letterByChar(lang: TargetLang, char: string): Letter | undefined {
  return LETTERS[lang].find((x) => x.char === char)
}

/** What the quiz and tiles show as the sound, e.g. `w / u`. */
export function soundLabel(letter: Letter): string {
  return letter.latin.join(' / ')
}
