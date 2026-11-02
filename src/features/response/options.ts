import type { Localized, QAAnswer, QAForm, QAItem, TargetLang, Token } from '@/content/types'
import type { Candidate } from '@/lib/curriculum'
import { shuffle } from '@/lib/distractors'
import type { KnownWords } from '@/lib/known-words'
import type { MatchGrade } from '@/lib/script/match'
import { gradeOutcome, Rating, type Grade } from '@/lib/srs'
import { isTemplate, matchQAAnswer, sameText } from './template'

export type AnswerMode = 'choose' | 'build' | 'free'

/*
 * Scaffolding from recognising a fitting answer to producing one:
 *  - new and young cards: choose the answer that fits among options
 *  - once it has been answered a few times: build the model answer from word tiles
 *  - stable cards: answer freely, typed or spoken
 * A card that comes back after a miss in the same session steps down one level.
 */
export function chooseMode(item: Pick<Candidate, 'card' | 'isNew'>, form: QAForm, attempt: number): AnswerMode {
  const card = item.card
  let level = !card || item.isNew || card.reps < 2 ? 0 : card.stability < 6 ? 1 : 2
  if (attempt > 0) level = Math.max(0, level - 1)
  if (level === 1 && (form.answers[0]?.tokens?.length ?? 0) < 2) level = 0
  return (['choose', 'build', 'free'] as const)[level]
}

export interface ChoiceOption {
  id: string
  text: string
  latin: string
  translation: Localized
  correct: boolean
}

const concreteAnswers = (form: QAForm) => form.answers.filter((a) => !isTemplate(a))

/** An answer is made of known words when every token (or, untokenized, every word) is one the learner has met. */
export function answerKnown(a: QAAnswer, known: KnownWords): boolean {
  return a.tokens?.length ? a.tokens.every(known.token) : known.text(a.text)
}

/**
 * One fitting answer plus answers to other questions in the same language, same unit first.
 * A distractor that would also be accepted as an answer to this question is never used.
 * With `known`, every option is made of words the learner has already met where the content allows:
 * an alternative answer with an unseen word is never the right option, and distractors come from
 * known words first.
 */
export function buildChoiceOptions(
  item: QAItem,
  lang: TargetLang,
  pool: QAItem[],
  random: () => number,
  count = 4,
  known?: KnownWords,
): ChoiceOption[] {
  const form = item[lang]!
  const own = concreteAnswers(form)
  const familiar = known ? own.filter((a) => answerKnown(a, known)) : own
  const rightPool = familiar.length ? familiar : own.slice(0, 1)
  const right = rightPool[Math.floor(random() * rightPool.length)] ?? form.answers[0]
  const options: ChoiceOption[] = [{ id: `${item.id}#right`, ...right, correct: true }]

  const others = pool.filter((q) => q.id !== item.id && q[lang])
  const byUnit = [others.filter((q) => q.unit === item.unit), others.filter((q) => q.unit !== item.unit)]
  const tiers = (known ? [true, false] : [false]).flatMap((strict) => byUnit.map((qs) => ({ qs, strict })))
  const used = new Set<string>()
  for (const { qs, strict } of tiers) {
    for (const q of shuffle(qs, random)) {
      if (options.length >= count) break
      if (used.has(q.id)) continue
      const candidates = shuffle(concreteAnswers(q[lang]!), random)
      const pick = candidates.find(
        (a) =>
          (!strict || answerKnown(a, known!)) &&
          matchQAAnswer(a.text, form.answers, lang).grade === 'wrong' &&
          !options.some((o) => sameText(o.text, a.text, lang)),
      )
      if (pick) {
        used.add(q.id)
        options.push({ id: `${q.id}#${q[lang]!.answers.indexOf(pick)}`, ...pick, correct: false })
      }
    }
  }
  return shuffle(options, random)
}

export interface Tile {
  id: string
  text: string
  latin: string
  gloss?: Localized
}

const TILE_PUNCT = /[.,!?;:،؛؟…]+$/u
const tileLabel = (s: string) => s.replace(TILE_PUNCT, '').trim()

function toTile(t: Token, id: string): Tile {
  return { id, text: tileLabel(t.text), latin: tileLabel(t.latin), gloss: t.gloss }
}

/** Word tiles for the model answer, plus a few plausible extra tiles taken from other answers (known words first). */
export function buildTiles(
  item: QAItem,
  lang: TargetLang,
  pool: QAItem[],
  random: () => number,
  extra = 3,
  known?: KnownWords,
): { answer: Tile[]; bank: Tile[] } {
  const form = item[lang]!
  const answer = (form.answers[0].tokens ?? []).map((t, i) => toTile(t, `a${i}`))
  const taken = new Set(answer.map((t) => t.text))
  const others = pool.filter((q) => q.id !== item.id && q[lang])
  const tokenPool = (qs: QAItem[]) => shuffle(qs.flatMap((q) => q[lang]!.answers.flatMap((a) => a.tokens ?? [])), random)
  const sameUnit = tokenPool(others.filter((q) => q.unit === item.unit))
  const all = tokenPool(others)
  const pools = known ? [sameUnit.filter(known.token), all.filter(known.token), sameUnit, all] : [sameUnit, all]
  const extras: Tile[] = []
  for (const tokens of pools) {
    for (const t of tokens) {
      if (extras.length >= extra) break
      const tile = toTile(t, `x${extras.length}`)
      if (!tile.text || [...taken].some((k) => sameText(k, tile.text, lang))) continue
      taken.add(tile.text)
      extras.push(tile)
    }
  }
  return { answer, bank: shuffle([...answer, ...extras], random) }
}

/** Built answers are checked strictly against the concrete model answers (a template slot would accept anything). */
export function checkTiles(chosen: Tile[], form: QAForm, lang: TargetLang): { grade: MatchGrade; index: number } {
  const built = chosen.map((t) => t.text).join(' ')
  const index = form.answers.findIndex((a) => !isTemplate(a) && sameText(a.text, built, lang))
  return index >= 0 ? { grade: 'exact', index } : { grade: 'wrong', index: -1 }
}

export const FAST_MS: Record<AnswerMode, number> = { choose: 4000, build: 9000, free: 12000 }

export interface GradeInput {
  mode: AnswerMode
  match: MatchGrade | null
  selfGrade?: Grade
  hintUsed: boolean
  attempt: number
  ms: number
}

/**
 * Choosing among options overestimates what the learner can say, so it never earns Easy.
 * The translation hint caps the grade at Hard, and a second showing in the same session never earns Easy.
 */
export function finalGrade({ mode, match, selfGrade, hintUsed, attempt, ms }: GradeInput): Grade {
  let g = gradeOutcome({ match, selfGrade, hintsUsed: hintUsed ? 1 : 0, attempts: 1, responseMs: ms, fastMs: FAST_MS[mode] })
  if (g === Rating.Easy && (mode === 'choose' || attempt > 0)) g = Rating.Good
  return g
}
