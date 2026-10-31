import curriculumDoc from '../../docs/CURRICULUM.md?raw'
import {
  acceptedForms,
  conceptById,
  concepts,
  grammarById,
  grammarPoints,
  qaItems,
  sentences,
  units,
} from '@/content'
import { grammarFileSchema, lexiconFileSchema, qaFileSchema, sentenceFileSchema } from '@/content/schema'
import { TARGET_LANGS, type TargetLang, type Token } from '@/content/types'
import { foldForMatch, foldLatin } from '@/lib/script/normalize'

const raw = {
  lexicon: import.meta.glob<{ concepts?: unknown[] }>('./data/lexicon/*.json', { eager: true, import: 'default' }),
  sentences: import.meta.glob<{ sentences?: unknown[] }>('./data/sentences/*.json', { eager: true, import: 'default' }),
  qa: import.meta.glob<{ items?: unknown[] }>('./data/qa/*.json', { eager: true, import: 'default' }),
  grammar: import.meta.glob<{ points?: unknown[] }>('./data/grammar/*.json', { eager: true, import: 'default' }),
}

const rawCount = <T>(files: Record<string, T>, key: keyof T) =>
  Object.values(files).reduce((n, f) => n + ((f[key] as unknown[] | undefined)?.length ?? 0), 0)

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>()
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)))
}

/** Grammar ids named in the "Grammar plan" table of docs/CURRICULUM.md. */
function plannedGrammarIds(doc: string): Set<string> {
  const section = doc.split(/^## Grammar plan\s*$/m)[1]?.split(/^## /m)[0] ?? ''
  return new Set(section.match(/\b(?:ckb|fa)-[a-z0-9]+(?:-[a-z0-9]+)*\b/g) ?? [])
}

interface TokenSite {
  where: string
  lang: TargetLang
  text: string
  latin: string
  tokens: Token[]
  distractors?: Token[]
}

function tokenSites(): TokenSite[] {
  const sites: TokenSite[] = []
  for (const s of sentences) {
    for (const lang of TARGET_LANGS) {
      const f = s[lang]
      if (f) {
        sites.push({ where: `sentence ${s.id} ${lang}`, lang, text: f.text, latin: f.latin, tokens: f.tokens, distractors: f.distractors })
      }
    }
  }
  for (const q of qaItems) {
    for (const lang of TARGET_LANGS) {
      const f = q[lang]
      if (!f) continue
      if (f.question.tokens) sites.push({ where: `qa ${q.id} ${lang} question`, lang, ...f.question, tokens: f.question.tokens })
      f.answers.forEach((a, i) => {
        if (a.tokens) sites.push({ where: `qa ${q.id} ${lang} answer ${i}`, lang, text: a.text, latin: a.latin, tokens: a.tokens })
      })
    }
  }
  for (const g of grammarPoints) {
    g.examples.forEach((ex, i) => {
      if (ex.tokens) sites.push({ where: `grammar ${g.id} example ${i}`, lang: g.lang, text: ex.text, latin: ex.latin, tokens: ex.tokens })
    })
  }
  return sites
}

describe('content files', () => {
  it('there is content of every kind', () => {
    expect(concepts.length).toBeGreaterThan(0)
    expect(sentences.length).toBeGreaterThan(0)
    expect(qaItems.length).toBeGreaterThan(0)
    expect(grammarPoints.length).toBeGreaterThan(0)
  })

  it.each([
    ['lexicon', raw.lexicon, lexiconFileSchema],
    ['sentences', raw.sentences, sentenceFileSchema],
    ['qa', raw.qa, qaFileSchema],
    ['grammar', raw.grammar, grammarFileSchema],
  ] as const)('every %s file matches the schema', (_, files, schema) => {
    const broken = Object.entries(files)
      .filter(([, data]) => !schema.safeParse(data).success)
      .map(([path]) => path)
    expect(broken).toEqual([])
  })

  it('no entry was skipped while loading', () => {
    expect(concepts.length).toBe(rawCount(raw.lexicon, 'concepts'))
    expect(sentences.length).toBe(rawCount(raw.sentences, 'sentences'))
    expect(qaItems.length).toBe(rawCount(raw.qa, 'items'))
    expect(grammarPoints.length).toBe(rawCount(raw.grammar, 'points'))
  })
})

describe('ids and references', () => {
  it('ids are unique within each kind', () => {
    expect(duplicates(units.map((u) => u.id))).toEqual([])
    expect(duplicates(concepts.map((c) => c.id))).toEqual([])
    expect(duplicates(sentences.map((s) => s.id))).toEqual([])
    expect(duplicates(qaItems.map((q) => q.id))).toEqual([])
    expect(duplicates(grammarPoints.map((g) => g.id))).toEqual([])
  })

  it('every item belongs to a known unit', () => {
    const unitIds = new Set(units.map((u) => u.id))
    const unknown = [
      ...concepts.map((c) => ['concept', c.id, c.unit]),
      ...sentences.map((s) => ['sentence', s.id, s.unit]),
      ...qaItems.map((q) => ['qa', q.id, q.unit]),
      ...grammarPoints.map((g) => ['grammar', g.id, g.unit]),
    ].filter(([, , unit]) => !unitIds.has(unit))
    expect(unknown).toEqual([])
  })

  it('unit order is a strict sequence', () => {
    const orders = units.map((u) => u.order)
    expect(new Set(orders).size).toBe(orders.length)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })

  it('every concept has at least one language, and its accepted forms start with the primary', () => {
    for (const c of concepts) {
      expect(TARGET_LANGS.some((l) => c[l]), c.id).toBe(true)
      for (const l of TARGET_LANGS) {
        const entry = c[l]
        if (entry) expect(acceptedForms(entry)[0]).toBe(entry.primary)
      }
    }
  })

  it('every token concept exists', () => {
    const unknown = tokenSites().flatMap((site) =>
      [...site.tokens, ...(site.distractors ?? [])]
        .filter((t) => t.concept && !conceptById.has(t.concept))
        .map((t) => `${site.where}: ${t.text} -> ${t.concept}`),
    )
    expect(unknown).toEqual([])
  })

  it('every token concept exists in the language of the token', () => {
    const missing = tokenSites().flatMap((site) =>
      site.tokens
        .filter((t) => t.concept && conceptById.has(t.concept) && !conceptById.get(t.concept)![site.lang])
        .map((t) => `${site.where}: ${t.concept} has no ${site.lang} entry`),
    )
    expect(missing).toEqual([])
  })

  it('every grammar point is in its own language and named with its language prefix', () => {
    expect(grammarPoints.filter((g) => !g.id.startsWith(`${g.lang}-`)).map((g) => g.id)).toEqual([])
  })

  it('grammar ids used by sentences exist or are planned in docs/CURRICULUM.md', () => {
    const planned = plannedGrammarIds(curriculumDoc)
    expect(planned.size).toBeGreaterThan(10)
    const unknown = sentences.flatMap((s) =>
      TARGET_LANGS.flatMap((lang) =>
        (s[lang]?.grammar ?? [])
          .filter((g) => !grammarById.has(g) && !planned.has(g))
          .map((g) => `${s.id} ${lang}: ${g}`),
      ),
    )
    expect(unknown).toEqual([])
  })

  it('sentences only reference grammar of their own language', () => {
    const wrong = sentences.flatMap((s) =>
      TARGET_LANGS.flatMap((lang) =>
        (s[lang]?.grammar ?? []).filter((g) => !g.startsWith(`${lang}-`)).map((g) => `${s.id} ${lang}: ${g}`),
      ),
    )
    expect(wrong).toEqual([])
  })
})

describe('tokens', () => {
  const sites = tokenSites()

  it('there are tokenized sentences to check', () => {
    expect(sites.filter((s) => s.where.startsWith('sentence')).length).toBe(
      sentences.reduce((n, s) => n + TARGET_LANGS.filter((l) => s[l]).length, 0),
    )
  })

  it('token texts join up to the text (after folding)', () => {
    const bad = sites
      .filter((s) => foldForMatch(s.tokens.map((t) => t.text).join(' '), s.lang) !== foldForMatch(s.text, s.lang))
      .map((s) => `${s.where}: "${s.tokens.map((t) => t.text).join(' ')}" vs "${s.text}"`)
    expect(bad).toEqual([])
  })

  it('token romanizations join up to the romanization (after folding)', () => {
    const bad = sites
      .filter((s) => foldLatin(s.tokens.map((t) => t.latin).join(' ')) !== foldLatin(s.latin))
      .map((s) => `${s.where}: "${s.tokens.map((t) => t.latin).join(' ')}" vs "${s.latin}"`)
    expect(bad).toEqual([])
  })

  it('every sentence has tokens and every token has a gloss in both base languages', () => {
    for (const s of sites) {
      if (s.where.startsWith('sentence')) expect(s.tokens.length, s.where).toBeGreaterThan(0)
      for (const t of s.tokens) {
        expect(t.gloss.en.trim(), `${s.where} ${t.text}`).not.toBe('')
        expect(t.gloss.sv.trim(), `${s.where} ${t.text}`).not.toBe('')
      }
    }
  })
})

describe('Q&A', () => {
  it('every language form has at least one answer, and every {slot} has example values', () => {
    for (const q of qaItems) {
      for (const lang of TARGET_LANGS) {
        const f = q[lang]
        if (!f) continue
        expect(f.answers.length, `${q.id} ${lang}`).toBeGreaterThan(0)
        for (const a of f.answers) {
          for (const slot of a.text.match(/\{(\w+)\}/g) ?? []) {
            expect(f.slots?.[slot.slice(1, -1)]?.length ?? 0, `${q.id} ${lang} ${slot}`).toBeGreaterThan(0)
          }
        }
      }
    }
  })
})

describe('plannedGrammarIds', () => {
  it('reads ids from the grammar plan table only', () => {
    const doc = '# C\n\n## Concept registry\n\nckb-not-grammar\n\n## Grammar plan\n\n| u | ckb-copula, ckb-to-have | fa-ezafe |\n'
    expect([...plannedGrammarIds(doc)].sort()).toEqual(['ckb-copula', 'ckb-to-have', 'fa-ezafe'])
  })
})
