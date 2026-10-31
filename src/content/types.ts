export const TARGET_LANGS = ['ckb', 'fa'] as const
export type TargetLang = (typeof TARGET_LANGS)[number]

export const BASE_LANGS = ['en', 'sv'] as const
export type BaseLang = (typeof BASE_LANGS)[number]

export const LEVELS = ['A1', 'A2', 'B1'] as const
export type Level = (typeof LEVELS)[number]

export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'postposition',
  'conjunction',
  'numeral',
  'interjection',
  'particle',
  'phrase',
  'question-word',
  'determiner',
] as const
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]

export type Register = 'neutral' | 'formal' | 'colloquial'

/** Text in both base languages. */
export interface Localized {
  en: string
  sv: string
}

/** A meaning in the learner's languages. `*Alt` are other accepted answers when typing. */
export interface Gloss extends Localized {
  enAlt?: string[]
  svAlt?: string[]
}

/** One written form of a word or phrase in a target language. */
export interface Form {
  /** Standard Arabic-script orthography (Sorani: Kurdish Unicode letters; Persian: Iranian orthography with ZWNJ). */
  script: string
  /** Learner romanization. Sorani: Hawar-style Kurdish Latin. Persian: see docs/CONTENT_GUIDE.md. */
  latin: string
  ipa?: string
  register?: Register
  /** e.g. 'sulaymani', 'hawleri', 'tehrani' */
  dialect?: string
  note?: Localized
}

export interface AudioRef {
  url: string
  /** Who recorded it / where it came from, shown to the user. */
  credit: string
  license: string
}

/** A claim by the author about where a form was checked. The validator re-checks what it can. */
export interface SourceClaim {
  source: SourceId
  /** Headword, sentence id, page number, ... */
  ref?: string
}

export type SourceId =
  | 'wiktionary'
  | 'tatoeba'
  | 'thackston-sorani-grammar'
  | 'kim-kurdish-grammar'
  | 'asosoft'
  | 'native-speaker'
  | 'author'

export interface LanguageEntry {
  primary: Form
  /** Other correct forms that are also accepted as answers (synonyms, spoken forms, dialect forms). */
  variants?: Form[]
  plural?: Form
  /** Verbs: present stem, used to build present-tense forms. */
  presentStem?: Form
  /** Verbs: past stem. */
  pastStem?: Form
  /** Short usage/culture/grammar note shown on the word card. */
  notes?: Localized
  audio?: AudioRef[]
  sources: SourceClaim[]
}

export interface Concept {
  /** Stable, kebab-case, unique across all units, e.g. `water`, `to-eat`, `thank-you`. */
  id: string
  unit: string
  pos: PartOfSpeech
  level: Level
  gloss: Gloss
  /** Disambiguates the sense, e.g. "(the fruit)". */
  senseNote?: Localized
  /** A single emoji used as a visual memory anchor. */
  emoji?: string
  ckb?: LanguageEntry
  fa?: LanguageEntry
  /** True when the Sorani and Persian words share an origin (e.g. نان nan / نان nân). Shown in compare mode. */
  cognate?: boolean
  tags?: string[]
}

/** A word-level piece of a sentence, in reading (logical) order. */
export interface Token {
  text: string
  latin: string
  gloss: Localized
  /** Concept this token is (a form of). Used to unlock sentences once the words are known. */
  concept?: string
  /** Leipzig-style morpheme gloss, e.g. `DUR-eat.PRS-1SG`. */
  morph?: string
}

export interface SentenceForm {
  text: string
  latin: string
  tokens: Token[]
  /** Everyday spoken version when it differs from the written one (mainly Persian). */
  colloquial?: { text: string; latin: string }
  /** Other correct ways to say it, accepted in typed answers. */
  alternatives?: Array<{ text: string; latin: string }>
  /** Plausible wrong tiles for word-bank exercises (wrong suffix, wrong word order clue, ...). */
  distractors?: Token[]
  grammar?: string[]
  sources: SourceClaim[]
}

export interface Sentence {
  id: string
  unit: string
  level: Level
  translation: Gloss
  ckb?: SentenceForm
  fa?: SentenceForm
}

export interface QAAnswer {
  text: string
  latin: string
  translation: Localized
  tokens?: Token[]
}

export interface QAForm {
  question: {
    text: string
    latin: string
    tokens?: Token[]
    /** Everyday spoken version of the question (mainly Persian). */
    colloquial?: { text: string; latin: string }
    /** Other common ways to ask the same thing. */
    alternatives?: Array<{ text: string; latin: string }>
  }
  /** Model answers. The first is the canonical one. Use `{slot}` for personal information. */
  answers: QAAnswer[]
  /** Example values for `{slot}` placeholders, e.g. names or cities. */
  slots?: Record<string, Array<{ text: string; latin: string; translation: Localized }>>
  sources: SourceClaim[]
}

export interface QAItem {
  id: string
  unit: string
  level: Level
  /** Meaning of the question in the base languages (hidden by default during practice). */
  question: Localized
  /** True when the answer is about the learner (name, home, family...). */
  personal?: boolean
  ckb?: QAForm
  fa?: QAForm
}

export interface GrammarExample {
  text: string
  latin: string
  translation: Localized
  tokens?: Token[]
}

export interface GrammarPoint {
  id: string
  unit: string
  lang: TargetLang
  level: Level
  title: Localized
  /** Short explanation. Supports **bold** and `code` only. Paragraphs separated by blank lines. */
  explanation: Localized
  examples: GrammarExample[]
  sources: SourceClaim[]
}

export interface Unit {
  id: string
  order: number
  title: Localized
  description: Localized
  /** Communicative goal: what the learner can say after this unit. */
  canDo: Localized
  emoji: string
}

/** Which of the four modules a card belongs to. */
export const SKILLS = ['recognition', 'recall', 'construction', 'response'] as const
export type Skill = (typeof SKILLS)[number]
