import { BookOpenCheck, Brain, Blocks, Images, MessagesSquare, type LucideIcon } from 'lucide-react'
import type { Skill, TargetLang } from '@/content/types'
import { defineStrings } from '@/i18n'

export interface ModuleMeta {
  skill: Skill
  slug: string
  step?: number
  icon: LucideIcon
  /** Tailwind classes using the module colour tokens. */
  bg: string
  text: string
  soft: string
  ring: string
  /** The first letter of the module's name in each language, drawn large on its card. */
  letter: Record<TargetLang, string>
}

export type PathSkill = Exclude<Skill, 'pictures'>

export interface PathModule extends ModuleMeta {
  skill: PathSkill
  step: number
}

/** The four steps of the course path, in order. */
export const MODULES: PathModule[] = [
  {
    skill: 'recognition',
    slug: 'recognition',
    step: 1,
    icon: BookOpenCheck,
    bg: 'bg-mod-recognition',
    text: 'text-mod-recognition',
    soft: 'bg-mod-recognition/10',
    ring: 'ring-mod-recognition/30',
    letter: { fa: 'ش', ckb: 'ن' }, // شناختن, ناسینەوە
  },
  {
    skill: 'recall',
    slug: 'recall',
    step: 2,
    icon: Brain,
    bg: 'bg-mod-recall',
    text: 'text-mod-recall',
    soft: 'bg-mod-recall/12',
    ring: 'ring-mod-recall/30',
    letter: { fa: 'ی', ckb: 'ب' }, // یادآوری, بیرهێنانەوە
  },
  {
    skill: 'construction',
    slug: 'sentences',
    step: 3,
    icon: Blocks,
    bg: 'bg-mod-construction',
    text: 'text-mod-construction',
    soft: 'bg-mod-construction/10',
    ring: 'ring-mod-construction/30',
    letter: { fa: 'ج', ckb: 'ڕ' }, // جمله‌سازی, ڕستەسازی
  },
  {
    skill: 'response',
    slug: 'conversation',
    step: 4,
    icon: MessagesSquare,
    bg: 'bg-mod-response',
    text: 'text-mod-response',
    soft: 'bg-mod-response/10',
    ring: 'ring-mod-response/30',
    letter: { fa: 'پ', ckb: 'پ' }, // پرسش و پاسخ, پرسیار و وەڵام
  },
]

export const PICTURES_MODULE: ModuleMeta = {
  skill: 'pictures',
  slug: 'pictures',
  icon: Images,
  bg: 'bg-mod-pictures',
  text: 'text-mod-pictures',
  soft: 'bg-mod-pictures/10',
  ring: 'ring-mod-pictures/30',
    letter: { fa: 'ت', ckb: 'و' }, // تصویر, وێنە
}

export const ALL_MODULES: ModuleMeta[] = [...MODULES, PICTURES_MODULE]

export const moduleBySlug = new Map(ALL_MODULES.map((m) => [m.slug, m]))
export const moduleBySkill = new Map(ALL_MODULES.map((m) => [m.skill, m]))

/** Why each module works, in one or two sentences, with the research behind it. */
export const moduleWhy = defineStrings({
  en: {
    recognition:
      'You remember a meaning better when you pull it from memory than when you read it again. This is the "testing effect", and memory research has found it over and over. You get feedback right after every answer, and reviews spread over several days (spaced repetition) make the word stick.',
    recall:
      'You get good at what you practise. To speak, you have to go from meaning to word, and that is harder than recognising a word. Studies of vocabulary learning find that recalling words yourself is the best way to learn to use them. You pick the word from four options. When you want it harder, switch to typing it or saying it aloud from memory.',
    construction:
      'Words only become speech when you can put them in order with the right endings. When you build sentences from words you already know, you can focus on the grammar: word order (the verb goes last), suffixes and agreement.',
    response:
      'To answer a question you first have to understand it, so you process it more deeply than when you repeat a model sentence. In studies of question-and-answer practice, learners remembered more in the long run than with repetition. This step is the closest to a real conversation.',
    pictures:
      'People remember pictures better than words (the picture superiority effect). Linking a word straight to a picture also skips the detour through English or Swedish. The photos show dishes and things as they look in Iran and Kurdistan.',
  },
  sv: {
    recognition:
      'Du minns en betydelse bättre om du plockar fram den ur minnet än om du läser den igen. Det kallas testeffekten, och minnesforskningen har visat den gång på gång. Du får veta direkt efter varje svar om det blev rätt, och repetitionerna sprids ut över flera dagar, så att ordet fastnar.',
    recall:
      'Du blir bra på det du övar på. För att kunna prata måste du gå från betydelse till ord, och det är svårare än att känna igen ordet. Forskning om ordinlärning visar att du lär dig använda ord bäst genom att själv plocka fram dem. Du väljer ordet bland fyra alternativ. Vill du ha det svårare kan du i stället skriva det eller säga det högt ur minnet.',
    construction:
      'Orden blir tal först när du kan sätta dem i rätt ordning med rätt ändelser. När du bygger meningar av ord du redan kan, kan du koncentrera dig på grammatiken: ordföljden (verbet sist), suffixen och kongruensen.',
    response:
      'För att svara på en fråga måste du först förstå den. Då bearbetar du språket djupare än när du härmar en färdig mening. Studier har visat att man minns mer på lång sikt när man övar med frågor och svar än när man upprepar. Det här steget ligger närmast ett riktigt samtal.',
    pictures:
      'Man minns bilder bättre än ord (bildöverlägsenhetseffekten). När du kopplar ordet direkt till en bild slipper du också omvägen via svenska eller engelska. Fotona visar maträtter och saker som de ser ut i Iran och Kurdistan.',
  },
})
