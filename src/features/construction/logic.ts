import type { Form, Localized, Sentence, SentenceForm, TargetLang, Token } from '@/content/types'
import { shuffle } from '@/lib/distractors'
import { matchTargetAnswer, type MatchGrade } from '@/lib/script/match'
import { foldForMatch, foldLatinLoose, isArabicScript } from '@/lib/script/normalize'
import { State, type StoredCard } from '@/lib/srs'

export type Mode = 'bank' | 'cloze' | 'typed'

const MODES: Mode[] = ['bank', 'cloze', 'typed']

/*
 * Scaffolded progression, most support first:
 *   bank   arrange tiles (recognising the right words and endings among distractors)
 *   cloze  produce one grammar-bearing word inside the sentence
 *   typed  produce the whole sentence from its meaning
 * A lapsed card, or a second showing after a miss in the same session, steps back one level.
 */
export function chooseMode(card: StoredCard | undefined, attempt: number): Mode {
  if (!card) return 'bank'
  let level = card.stability >= 10 ? 2 : card.stability >= 4 ? 1 : 0
  if (card.state === State.Relearning) level -= 1
  level -= attempt
  return MODES[Math.max(0, Math.min(2, level))]
}

const PUNCT = /[.,!?;:،؛؟«»"()[\]{}…]/g

/** Removes sentence punctuation (not apostrophes or hyphens, which carry meaning in romanization). */
export function stripPunct(text: string): string {
  return text.replace(PUNCT, ' ').replace(/\s+/g, ' ').trim()
}

export interface Tile {
  id: number
  text: string
  latin: string
  gloss?: Localized
  source: 'sentence' | 'distractor' | 'extra'
}

const fold = (text: string, lang: TargetLang) => foldForMatch(text, lang)

/**
 * Tokens from other sentences, used to pad the bank when a sentence has fewer than two distractors.
 * Same-unit words first, so extra tiles are words the learner has likely met.
 */
export function pickExtraTokens(
  sentence: Sentence,
  lang: TargetLang,
  count: number,
  random: () => number,
  pool: Sentence[],
  exclude: Set<string>,
): Token[] {
  if (count <= 0) return []
  const others = pool.filter((s) => s.id !== sentence.id && s[lang])
  const tiers = [others.filter((s) => s.unit === sentence.unit), others.filter((s) => s.unit !== sentence.unit)]
  const out: Token[] = []
  const seen = new Set(exclude)
  for (const tier of tiers) {
    for (const token of shuffle(tier.flatMap((s) => s[lang]!.tokens), random)) {
      if (out.length >= count) return out
      const key = fold(token.text, lang)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(token)
    }
  }
  return out
}

/** Every accepted word sequence for the word bank: the canonical tokens, then each alternative split into words. */
export function acceptedSequences(form: SentenceForm): string[][] {
  return [form.tokens.map((t) => t.text), ...(form.alternatives ?? []).map((a) => a.text.split(/\s+/).filter(Boolean))]
}

/** Sentence tokens + distractors (+ padding from other sentences), shuffled with a seeded generator. */
export function buildTiles(sentence: Sentence, lang: TargetLang, random: () => number, pool: Sentence[]): Tile[] {
  const form = sentence[lang]!
  const accepted = new Set(acceptedSequences(form).flat().map((w) => fold(w, lang)))
  const tiles: Tile[] = form.tokens.map((t, id) => ({ id, text: t.text, latin: t.latin, gloss: t.gloss, source: 'sentence' }))
  const used = new Set(form.tokens.map((t) => fold(t.text, lang)))
  for (const d of form.distractors ?? []) {
    const key = fold(d.text, lang)
    if (used.has(key)) continue
    used.add(key)
    tiles.push({ id: tiles.length, text: d.text, latin: d.latin, gloss: d.gloss, source: 'distractor' })
  }
  const distractorCount = tiles.length - form.tokens.length
  const extras = pickExtraTokens(sentence, lang, 2 - distractorCount, random, pool, new Set([...used, ...accepted]))
  for (const t of extras) tiles.push({ id: tiles.length, text: t.text, latin: t.latin, gloss: t.gloss, source: 'extra' })

  const canonical = form.tokens.map((_, i) => i).join(',')
  let order = shuffle(tiles, random)
  // Never hand out the answer as the first tiles in reading order.
  for (let i = 0; i < 4 && order.slice(0, form.tokens.length).map((t) => t.id).join(',') === canonical; i++) {
    order = shuffle(tiles, random)
  }
  return order
}

/** Word-level edit distance with adjacent transpositions (one swapped pair counts as one error). */
export function sequenceDistance(a: string[], b: string[]): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** "One word off" only counts as nearly right when the sentence is long enough for one word to be a detail. */
const NEAR_MIN_WORDS = 3

export type TileResult = 'correct' | 'near' | 'wrong'

export interface TileCheck {
  result: TileResult
  /** Index into `acceptedSequences(form)` of the version the answer is closest to. */
  matched: number
}

export function checkTiles(placed: string[], form: SentenceForm, lang: TargetLang): TileCheck {
  const sequences = acceptedSequences(form)
  const joined = fold(placed.join(' '), lang)
  const exact = sequences.findIndex((seq) => fold(seq.join(' '), lang) === joined)
  if (placed.length && exact >= 0) return { result: 'correct', matched: exact }
  const words = placed.map((w) => fold(w, lang))
  let best = { distance: Infinity, matched: 0, length: 0 }
  sequences.forEach((seq, i) => {
    const distance = sequenceDistance(words, seq.map((w) => fold(w, lang)))
    if (distance < best.distance) best = { distance, matched: i, length: seq.length }
  })
  const near = placed.length > 0 && best.distance <= 1 && best.length >= NEAR_MIN_WORDS
  return { result: near ? 'near' : 'wrong', matched: best.matched }
}

export type TileStatus = 'correct' | 'misplaced' | 'wrong'

/**
 * Per placed tile: in the right place, a word of the sentence in the wrong place, or not part of it at all.
 * Uses the same alignment as the typed diff, which prefers matching words position by position.
 */
export function tileStatuses(placed: string[], expected: string[], lang: TargetLang): TileStatus[] {
  const key = (w: string) => fold(w, lang)
  const ops = alignWords(placed, expected, key).filter(
    (op): op is Exclude<DiffOp, { type: 'missing' }> => op.type !== 'missing',
  )
  const remaining = new Map<string, number>()
  expected.forEach((w) => remaining.set(key(w), (remaining.get(key(w)) ?? 0) + 1))
  ops.forEach((op) => op.type === 'same' && remaining.set(key(op.input), remaining.get(key(op.input))! - 1))
  return ops.map((op) => {
    if (op.type === 'same') return 'correct'
    const w = key(op.input)
    const left = remaining.get(w) ?? 0
    if (left > 0) {
      remaining.set(w, left - 1)
      return 'misplaced'
    }
    return 'wrong'
  })
}

/** Tokens carrying an inflection or clitic (Leipzig morph with a morpheme boundary) teach the most. */
function clozeScore(t: Token): number {
  const inflected = !!t.morph && /[-=]/.test(t.morph)
  if (t.concept && inflected) return 3
  if (t.concept && t.morph) return 2
  if (t.concept) return 1
  return inflected ? 1 : 0
}

/** Picks the token to blank out: concept-linked and grammar-bearing first, ties broken by the seeded generator. */
export function pickClozeIndex(tokens: Token[], random: () => number): number {
  const scores = tokens.map(clozeScore)
  const max = Math.max(...scores)
  const best = scores.flatMap((s, i) => (s === max ? [i] : []))
  return best[Math.floor(random() * best.length)] ?? 0
}

/** Accepted answers for a blank: the token itself, plus the word an alternative has in the same slot (when the rest is identical). */
export function clozeForms(form: SentenceForm, index: number, lang: TargetLang): Form[] {
  const token = form.tokens[index]
  const forms: Form[] = [{ script: stripPunct(token.text), latin: stripPunct(token.latin) }]
  const words = form.tokens.map((t) => fold(t.text, lang))
  for (const alt of form.alternatives ?? []) {
    const altWords = alt.text.split(/\s+/)
    const altLatin = alt.latin.split(/\s+/)
    if (altWords.length !== words.length || altLatin.length !== words.length) continue
    const sameElsewhere = altWords.every((w, i) => i === index || fold(w, lang) === words[i])
    if (sameElsewhere && fold(altWords[index], lang) !== words[index]) {
      forms.push({ script: stripPunct(altWords[index]), latin: stripPunct(altLatin[index]) })
    }
  }
  return forms
}

export interface SentenceVersion {
  text: string
  latin: string
  kind: 'canonical' | 'alternative' | 'colloquial'
}

export function sentenceVersions(form: SentenceForm): SentenceVersion[] {
  return [
    { text: form.text, latin: form.latin, kind: 'canonical' },
    ...(form.alternatives ?? []).map((a) => ({ ...a, kind: 'alternative' as const })),
    ...(form.colloquial ? [{ ...form.colloquial, kind: 'colloquial' as const }] : []),
  ]
}

export type DiffOp =
  | { type: 'same'; input: string; expected: string }
  | { type: 'sub'; input: string; expected: string }
  | { type: 'extra'; input: string }
  | { type: 'missing'; expected: string }

/** Word-level alignment of an answer against the expected words (Levenshtein backtrace). */
export function alignWords(input: string[], expected: string[], key: (w: string) => string): DiffOp[] {
  const a = input.map(key)
  const b = expected.map(key)
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  const ops: DiffOp[] = []
  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      ops.push({ type: a[i - 1] === b[j - 1] ? 'same' : 'sub', input: input[i - 1], expected: expected[j - 1] })
      i--
      j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ type: 'extra', input: input[i - 1] })
      i--
    } else {
      ops.push({ type: 'missing', expected: expected[j - 1] })
      j--
    }
  }
  return ops.reverse()
}

export interface TypedCheck {
  grade: MatchGrade
  /** True when the answer was off by a single word: graded like a typo. */
  oneWordOff: boolean
  version: SentenceVersion
  inputScript: 'arabic' | 'latin'
  diff: DiffOp[]
}

const splitWords = (text: string) => stripPunct(text).split(' ').filter(Boolean)

/** Grades a fully typed sentence against the written form, its alternatives and the spoken version. */
export function checkTyped(input: string, form: SentenceForm, lang: TargetLang): TypedCheck {
  const versions = sentenceVersions(form)
  const accepted = versions.map((v) => ({ script: stripPunct(v.text), latin: stripPunct(v.latin) }))
  const r = matchTargetAnswer(stripPunct(input), accepted, lang)
  const inputScript = isArabicScript(input) ? 'arabic' : 'latin'
  const key = inputScript === 'arabic' ? (w: string) => fold(w, lang) : (w: string) => foldLatinLoose(w)
  const pick = (v: SentenceVersion) => (inputScript === 'arabic' ? v.text : v.latin)
  const words = splitWords(input)

  let best = { version: versions[0], distance: Infinity }
  for (const v of versions) {
    const distance = sequenceDistance(words.map(key), splitWords(pick(v)).map(key))
    if (distance < best.distance) best = { version: v, distance }
  }
  const matchedIdx = accepted.indexOf(r.expected)
  const version = r.grade !== 'wrong' && matchedIdx >= 0 ? versions[matchedIdx] : best.version
  const expectedWords = splitWords(pick(version))
  let grade = r.grade
  const oneWordOff = grade === 'wrong' && words.length > 0 && best.distance <= 1 && expectedWords.length >= NEAR_MIN_WORDS
  if (oneWordOff) grade = 'typo'
  return { grade, oneWordOff, version, inputScript, diff: alignWords(words, expectedWords, key) }
}

/** Glossing abbreviations used in `Token.morph`, expanded for the legend. */
export function morphLabels(morph: string): string[] {
  return [...new Set(morph.split(/[-=.]/).filter((p) => /^[123]?[A-Z]+$/.test(p)))]
}
