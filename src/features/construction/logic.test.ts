import { describe, expect, it } from 'vitest'
import { sentenceById, sentencesFor } from '@/content'
import type { Sentence } from '@/content/types'
import { seededRandom } from '@/lib/distractors'
import { newCard, State } from '@/lib/srs'
import {
  alignWords,
  buildTiles,
  checkTiles,
  checkTyped,
  chooseMode,
  clozeForms,
  pickClozeIndex,
  sequenceDistance,
  stripPunct,
  tileStatuses,
} from './logic'

const get = (id: string) => {
  const s = sentenceById.get(id)
  if (!s) throw new Error(`missing sentence ${id}`)
  return s
}

const iAmSara = get('i-am-sara')
const myName = get('my-name-is-sara')

describe('checkTiles', () => {
  it('accepts the canonical order and ignores punctuation', () => {
    const fa = myName.fa!
    expect(checkTiles(fa.tokens.map((t) => t.text), fa, 'fa')).toEqual({ result: 'correct', matched: 0 })
    expect(checkTiles(fa.tokens.map((t) => stripPunct(t.text)), fa, 'fa').result).toBe('correct')
    expect(checkTiles(['من', 'سارام.'], iAmSara.ckb!, 'ckb').result).toBe('correct')
  })

  it('accepts alternatives', () => {
    const fa = myName.fa!
    const alt = fa.alternatives![0].text.split(' ')
    expect(checkTiles(alt, fa, 'fa')).toEqual({ result: 'correct', matched: 1 })
  })

  it('rejects a distractor in a short sentence', () => {
    expect(checkTiles(['من', 'سارایت.'], iAmSara.ckb!, 'ckb').result).toBe('wrong')
  })

  it('treats one wrong tile or one swapped pair in a longer sentence as nearly right', () => {
    const fa = myName.fa!
    const words = fa.tokens.map((t) => t.text)
    expect(checkTiles([...words.slice(0, 3), 'هستم.'], fa, 'fa').result).toBe('near')
    expect(checkTiles([words[1], words[0], words[2], words[3]], fa, 'fa').result).toBe('near')
    expect(checkTiles([...words].reverse(), fa, 'fa').result).toBe('wrong')
    expect(checkTiles(words.slice(0, 2), fa, 'fa').result).toBe('wrong')
  })

  it('wrong order of a two-word sentence is wrong', () => {
    expect(checkTiles(['سارام.', 'من'], iAmSara.ckb!, 'ckb').result).toBe('wrong')
    expect(checkTiles([], iAmSara.ckb!, 'ckb').result).toBe('wrong')
  })
})

describe('tileStatuses', () => {
  it('marks tiles as correct, misplaced or not in the sentence', () => {
    const expected = ['اسم', 'من', 'سارا', 'است.']
    expect(tileStatuses(['من', 'اسم', 'سارا', 'هستم.'], expected, 'fa')).toEqual(['misplaced', 'misplaced', 'correct', 'wrong'])
    expect(tileStatuses(expected, expected, 'fa')).toEqual(['correct', 'correct', 'correct', 'correct'])
    expect(tileStatuses(['سارام.', 'سارایە.'], ['من', 'سارام.'], 'ckb')).toEqual(['misplaced', 'wrong'])
    expect(tileStatuses(['اسم', 'سارا', 'است.'], expected, 'fa')).toEqual(['correct', 'correct', 'correct'])
  })
})

describe('buildTiles', () => {
  it('contains every token and distractor, shuffled deterministically', () => {
    const pool = sentencesFor('fa')
    const a = buildTiles(myName, 'fa', seededRandom('k:0'), pool)
    const b = buildTiles(myName, 'fa', seededRandom('k:0'), pool)
    expect(a).toEqual(b)
    const texts = a.map((t) => t.text)
    for (const t of myName.fa!.tokens) expect(texts).toContain(t.text)
    for (const d of myName.fa!.distractors!) expect(texts).toContain(d.text)
    expect(a.map((t) => t.id).slice(0, 4).join(',')).not.toBe('0,1,2,3')
  })

  it('pads with words from other sentences when distractors are missing', () => {
    const bare: Sentence = { ...iAmSara, ckb: { ...iAmSara.ckb!, distractors: [] } }
    const tiles = buildTiles(bare, 'ckb', seededRandom('x'), sentencesFor('ckb'))
    const extras = tiles.filter((t) => t.source === 'extra')
    expect(extras).toHaveLength(2)
    for (const e of extras) expect(['من', 'سارام.']).not.toContain(e.text)
    const one: Sentence = { ...iAmSara, ckb: { ...iAmSara.ckb!, distractors: iAmSara.ckb!.distractors!.slice(0, 1) } }
    expect(buildTiles(one, 'ckb', seededRandom('x'), sentencesFor('ckb')).filter((t) => t.source === 'extra')).toHaveLength(1)
  })
})

describe('cloze', () => {
  it('blanks a concept-linked inflected token', () => {
    expect(pickClozeIndex(iAmSara.ckb!.tokens, seededRandom('a'))).toBe(1)
    expect(pickClozeIndex(myName.fa!.tokens, seededRandom('a'))).toBe(0)
  })

  it('always picks a grammar-bearing token across all real sentences', () => {
    for (const lang of ['ckb', 'fa'] as const) {
      for (const s of sentencesFor(lang)) {
        const tokens = s[lang]!.tokens
        const i = pickClozeIndex(tokens, seededRandom(s.id))
        if (tokens.some((t) => t.concept)) expect(tokens[i].concept, `${lang}:${s.id}`).toBeTruthy()
      }
    }
  })

  it('accepts the token without punctuation and an alternative in the same slot', () => {
    expect(clozeForms(iAmSara.ckb!, 1, 'ckb')[0]).toEqual({ script: 'سارام', latin: 'Saram' })
    const form = { ...myName.fa!, alternatives: [{ text: 'اسمت من سارا است.', latin: 'esmat man Sârâ ast.' }] }
    expect(clozeForms(form, 0, 'fa').map((f) => f.script)).toEqual(['اسم', 'اسمت'])
  })
})

describe('chooseMode', () => {
  const card = (stability: number, state = State.Review) => ({ ...newCard(new Date()), stability, state })
  it('moves from word bank to cloze to typed as the card matures', () => {
    expect(chooseMode(undefined, 0)).toBe('bank')
    expect(chooseMode(card(1), 0)).toBe('bank')
    expect(chooseMode(card(5), 0)).toBe('cloze')
    expect(chooseMode(card(12), 0)).toBe('typed')
  })
  it('steps back after a lapse or a miss in the same session', () => {
    expect(chooseMode(card(12), 1)).toBe('cloze')
    expect(chooseMode(card(12, State.Relearning), 0)).toBe('cloze')
    expect(chooseMode(card(5), 2)).toBe('bank')
  })
})

describe('checkTyped', () => {
  const fa = iAmSara.fa!
  it('accepts script, Latin, missing punctuation and the spoken version', () => {
    expect(checkTyped('من سارا هستم.', fa, 'fa').grade).toBe('exact')
    expect(checkTyped('من سارا هستم', fa, 'fa').grade).toBe('exact')
    expect(checkTyped('man Sârâ hastam', fa, 'fa').grade).toBe('exact')
    const spoken = checkTyped('من سارام', fa, 'fa')
    expect(spoken.grade).toBe('exact')
    expect(spoken.version.kind).toBe('colloquial')
  })

  it('grades one wrong word as nearly right and shows a word diff', () => {
    expect(checkTyped('من سارا هستی', fa, 'fa').grade).toBe('typo')
    const r = checkTyped('من علی هستم', fa, 'fa')
    expect(r.grade).toBe('typo')
    expect(r.oneWordOff).toBe(true)
    expect(r.diff.map((o) => o.type)).toEqual(['same', 'sub', 'same'])
  })

  it('is wrong when far off', () => {
    const r = checkTyped('تو کجا', fa, 'fa')
    expect(r.grade).toBe('wrong')
    expect(r.diff.some((o) => o.type !== 'same')).toBe(true)
  })
})

describe('alignment helpers', () => {
  it('counts an adjacent swap as one edit', () => {
    expect(sequenceDistance(['a', 'b', 'c'], ['b', 'a', 'c'])).toBe(1)
    expect(sequenceDistance(['a'], ['a', 'b'])).toBe(1)
  })
  it('reports missing and extra words', () => {
    const id = (w: string) => w
    expect(alignWords(['a', 'c'], ['a', 'b', 'c'], id).map((o) => o.type)).toEqual(['same', 'missing', 'same'])
    expect(alignWords(['a', 'x', 'b'], ['a', 'b'], id).map((o) => o.type)).toEqual(['same', 'extra', 'same'])
  })
})
