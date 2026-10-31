import { BookOpenCheck, Brain, Blocks, MessagesSquare, type LucideIcon } from 'lucide-react'
import type { Skill } from '@/content/types'
import { defineStrings } from '@/i18n'

export interface ModuleMeta {
  skill: Skill
  slug: string
  step: number
  icon: LucideIcon
  /** Tailwind classes using the module colour tokens. */
  bg: string
  text: string
  soft: string
  ring: string
}

export const MODULES: ModuleMeta[] = [
  {
    skill: 'recognition',
    slug: 'recognition',
    step: 1,
    icon: BookOpenCheck,
    bg: 'bg-mod-recognition',
    text: 'text-mod-recognition',
    soft: 'bg-mod-recognition/10',
    ring: 'ring-mod-recognition/30',
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
  },
]

export const moduleBySlug = new Map(MODULES.map((m) => [m.slug, m]))
export const moduleBySkill = new Map(MODULES.map((m) => [m.skill, m]))

/** Why each module works, in one or two sentences, with the research behind it. */
export const moduleWhy = defineStrings({
  en: {
    recognition:
      'Retrieving a meaning from memory (rather than re-reading it) is one of the most robust findings in memory research, the "testing effect". Immediate feedback after every answer and reviews spread over days (spaced repetition) make it stick.',
    recall:
      'You get good at what you practise: going from meaning to word is what speaking needs, and it is harder than recognising. Studies of vocabulary learning find productive recall builds productive knowledge best. No options, no hints, just memory.',
    construction:
      'Words only become speech when you can put them in order with the right endings. Building sentences from words you already know focuses attention on grammar: word order (verb last), suffixes and agreement.',
    response:
      'Answering a question requires understanding it first, which leads to deeper processing than repeating a model sentence. Studies of question-and-answer practice found better long-term retention than repetition. This is the closest step to a real conversation.',
  },
  sv: {
    recognition:
      'Att plocka fram en betydelse ur minnet (i stället för att läsa om den) är ett av minnesforskningens mest robusta resultat, "testeffekten". Direkt återkoppling efter varje svar och repetitioner utspridda över dagar (spridd repetition) gör att det fastnar.',
    recall:
      'Man blir bra på det man övar på: att gå från betydelse till ord är vad talet kräver, och det är svårare än att känna igen. Forskning om ordinlärning visar att produktiv återkallning bygger produktiv kunskap bäst. Inga alternativ, inga ledtrådar, bara minnet.',
    construction:
      'Ord blir tal först när du kan sätta dem i rätt ordning med rätt ändelser. Att bygga meningar av ord du redan kan riktar uppmärksamheten mot grammatiken: ordföljd (verbet sist), suffix och kongruens.',
    response:
      'Att svara på en fråga kräver att man först förstår den, vilket ger djupare bearbetning än att upprepa en förebildsmening. Studier av fråga-svar-övning visar bättre långsiktigt minne än upprepning. Det här är steget närmast ett riktigt samtal.',
  },
})
