import { acceptedForms, conceptById, conceptsFor } from '@/content'
import type { Concept, TargetLang } from '@/content/types'
import { pickConceptDistractors, seededRandom, shuffle } from './distractors'
import { foldForMatch } from './script/normalize'

const draw = (seed: string, n = 20) => {
  const r = seededRandom(seed)
  return Array.from({ length: n }, () => r())
}

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    expect(draw('ckb:recognition:water:0')).toEqual(draw('ckb:recognition:water:0'))
  })

  it('gives different sequences for different seeds', () => {
    expect(draw('ckb:recognition:water:0')).not.toEqual(draw('ckb:recognition:water:1'))
    expect(draw('a')).not.toEqual(draw('b'))
    expect(draw('')).not.toEqual(draw('a'))
  })

  it('stays in [0, 1) and is roughly uniform', () => {
    const xs = draw('uniform', 10_000)
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean).toBeGreaterThan(0.47)
    expect(mean).toBeLessThan(0.53)
    const buckets = Array.from({ length: 10 }, (_, i) => xs.filter((x) => Math.floor(x * 10) === i).length)
    for (const b of buckets) expect(b).toBeGreaterThan(800)
  })
})

describe('shuffle', () => {
  it('returns a permutation without touching the input', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f']
    const out = shuffle(input, seededRandom('s'))
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect([...out].sort()).toEqual(input)
  })

  it('is deterministic for a seed', () => {
    const input = Array.from({ length: 30 }, (_, i) => i)
    expect(shuffle(input, seededRandom('x'))).toEqual(shuffle(input, seededRandom('x')))
    expect(shuffle(input, seededRandom('x'))).not.toEqual(shuffle(input, seededRandom('y')))
  })
})

function scripts(c: Concept, lang: TargetLang): Set<string> {
  return new Set(acceptedForms(c[lang]!).map((f) => foldForMatch(f.script, lang)))
}

describe.each(['ckb', 'fa'] as const)('pickConceptDistractors (%s, real lexicon)', (lang) => {
  const pool = conceptsFor(lang)

  it.each(['en', 'sv'] as const)('never offers the target, its gloss or its word again (%s)', (base) => {
    for (const target of pool) {
      for (const seed of ['1', '2', '3']) {
        const out = pickConceptDistractors(target, lang, base, 3, seededRandom(`${target.id}:${seed}`))
        expect(out).toHaveLength(Math.min(3, pool.length - 1))
        const glosses = out.map((c) => c.gloss[base].toLowerCase())
        expect(out.map((c) => c.id)).not.toContain(target.id)
        expect(glosses, target.id).not.toContain(target.gloss[base].toLowerCase())
        expect(new Set(glosses).size, target.id).toBe(glosses.length)
        const targetScripts = scripts(target, lang)
        for (const c of out) {
          const shared = [...scripts(c, lang)].filter((s) => targetScripts.has(s))
          expect(shared, `${target.id} vs ${c.id}`).toEqual([])
        }
        const optionWords = out.flatMap((c) => [...scripts(c, lang)])
        expect(new Set(optionWords).size, `options for ${target.id}`).toBe(optionWords.length)
      }
    }
  })

  it('respects count', () => {
    const target = pool[0]
    for (const n of [0, 1, 2, 5]) {
      expect(pickConceptDistractors(target, lang, 'en', n, seededRandom('n'))).toHaveLength(n)
    }
  })

  it('is deterministic for a seed', () => {
    const target = pool[Math.floor(pool.length / 2)]
    const ids = (seed: string) => pickConceptDistractors(target, lang, 'sv', 3, seededRandom(seed)).map((c) => c.id)
    expect(ids('same')).toEqual(ids('same'))
  })

  it('prefers the same part of speech and unit', () => {
    const target = pool.find((c) => pool.filter((o) => o.pos === c.pos && o.unit === c.unit).length >= 5)!
    const out = pickConceptDistractors(target, lang, 'en', 3, seededRandom('pos'))
    for (const c of out) expect([c.pos, c.unit]).toEqual([target.pos, target.unit])
  })

  it('prefers known words once the same-unit tier is used up', () => {
    const target = pool[0]
    const known = new Set(pool.filter((c) => c.pos === target.pos && c.unit !== target.unit).slice(0, 3).map((c) => c.id))
    const sameTier = pool.filter((c) => c.id !== target.id && c.pos === target.pos && c.unit === target.unit).length
    const out = pickConceptDistractors(target, lang, 'en', sameTier + known.size, seededRandom('k'), known)
    const outside = out.filter((c) => c.unit !== target.unit || c.pos !== target.pos)
    for (const c of outside) expect(known.has(c.id), c.id).toBe(true)
  })
})

describe('pickConceptDistractors: homographs', () => {
  it.each([
    ['ckb', 'woman', 'wife'],
    ['fa', 'woman', 'wife'],
    ['fa', 'husband', 'wife'],
    ['ckb', 'family', 'wife'],
    ['ckb', 'that', 'he-she'],
  ] as const)('%s: %s and %s share a word, so neither is a distractor for the other', (lang, a, b) => {
    const A = conceptById.get(a)
    const B = conceptById.get(b)
    if (!A?.[lang] || !B?.[lang]) return
    for (let i = 0; i < 30; i++) {
      expect(pickConceptDistractors(A, lang, 'en', 8, seededRandom(`${i}`)).map((c) => c.id)).not.toContain(b)
      expect(pickConceptDistractors(B, lang, 'en', 8, seededRandom(`${i}`)).map((c) => c.id)).not.toContain(a)
    }
  })
})
