/**
 * Validates all learning content and computes verification evidence.
 *
 *   npm run content:check            validate, write src/content/generated/evidence.json + docs/content-report.md
 *   npm run content:check -- --quiet only print errors and the summary
 *
 * Exits non-zero on any error. Warnings are listed in the report.
 */
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import {
  grammarFileSchema,
  lexiconFileSchema,
  qaFileSchema,
  sentenceFileSchema,
  unitSchema,
} from '../src/content/schema'
import type {
  Concept,
  Form,
  GrammarPoint,
  QAItem,
  Sentence,
  SentenceForm,
  TargetLang,
  Token,
} from '../src/content/types'
import { foldForMatch, foldLatin } from '../src/lib/script/normalize'
import { lintLatin, lintScript } from '../src/lib/script/lint'
import { checkRomanization } from '../src/lib/script/skeleton'
import {
  conceptGlossesEn,
  evidenceLevel,
  formEvidence,
  reference,
  swedishMatches,
  type EvidenceLevel,
} from './lib/reference'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'src/content/data')
const quiet = process.argv.includes('--quiet')
const LANGS: TargetLang[] = ['ckb', 'fa']

interface Issue {
  severity: 'error' | 'warning'
  where: string
  message: string
}
const issues: Issue[] = []
const error = (where: string, message: string) => issues.push({ severity: 'error', where, message })
const warn = (where: string, message: string) => issues.push({ severity: 'warning', where, message })

function readDir<S extends z.ZodType>(dir: string, schema: S): Array<{ file: string; data: z.infer<S> }> {
  const full = path.join(DATA, dir)
  if (!fs.existsSync(full)) return []
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const rel = `${dir}/${f}`
      let raw: unknown
      try {
        raw = JSON.parse(fs.readFileSync(path.join(full, f), 'utf8'))
      } catch (e) {
        error(rel, `invalid JSON: ${(e as Error).message}`)
        return []
      }
      const r = schema.safeParse(raw)
      if (!r.success) {
        error(rel, z.prettifyError(r.error))
        return []
      }
      return [{ file: rel, data: r.data }]
    })
}

const units = z.array(unitSchema).parse(JSON.parse(fs.readFileSync(path.join(DATA, 'units.json'), 'utf8')).units)
const unitIds = new Set(units.map((u) => u.id))

const lexicon = readDir('lexicon', lexiconFileSchema).flatMap(({ file, data }) =>
  data.concepts.map((c) => ({ file, c: c as Concept })),
)
const sentenceEntries = readDir('sentences', sentenceFileSchema).flatMap(({ file, data }) =>
  data.sentences.map((s) => ({ file, s: s as Sentence })),
)
const qaEntries = readDir('qa', qaFileSchema).flatMap(({ file, data }) => data.items.map((q) => ({ file, q: q as QAItem })))
const grammarEntries = readDir('grammar', grammarFileSchema).flatMap(({ file, data }) =>
  data.points.map((g) => ({ file, g: g as GrammarPoint })),
)

function checkUniqueIds(kind: string, items: Array<{ file: string; id: string }>) {
  const seen = new Map<string, string>()
  for (const { file, id } of items) {
    if (seen.has(id)) error(file, `duplicate ${kind} id "${id}" (also in ${seen.get(id)})`)
    seen.set(id, file)
  }
}
checkUniqueIds('concept', lexicon.map(({ file, c }) => ({ file, id: c.id })))
checkUniqueIds('sentence', sentenceEntries.map(({ file, s }) => ({ file, id: s.id })))
checkUniqueIds('qa', qaEntries.map(({ file, q }) => ({ file, id: q.id })))
checkUniqueIds('grammar', grammarEntries.map(({ file, g }) => ({ file, id: g.id })))

const conceptIds = new Set(lexicon.map(({ c }) => c.id))
const grammarIds = new Set(grammarEntries.map(({ g }) => g.id))

function checkUnit(where: string, unit: string) {
  if (!unitIds.has(unit)) error(where, `unknown unit "${unit}"`)
}

function lintForm(where: string, form: { script?: string; text?: string; latin: string }, lang: TargetLang) {
  const script = form.script ?? form.text ?? ''
  for (const i of lintScript(script, lang)) issues.push({ ...i, where, message: `${i.message} [${script}]` })
  for (const i of lintLatin(form.latin, lang)) issues.push({ ...i, where, message: i.message })
}

const withoutSlots = (s: string) => s.replace(/\{\w+\}/g, ' ').replace(/\s+/g, ' ').trim()

function checkTokens(where: string, tokens: Token[], text: string, latin: string, lang: TargetLang) {
  for (const t of tokens) {
    if (t.concept && !conceptIds.has(t.concept)) error(where, `token "${t.text}" refers to unknown concept "${t.concept}"`)
    const plain = { text: withoutSlots(t.text), latin: withoutSlots(t.latin) }
    if (!plain.text) continue
    lintForm(`${where} token "${t.text}"`, plain, lang)
    const rom = checkRomanization(plain.text, plain.latin, lang)
    if (!rom.ok) warn(where, `token "${t.text}" / "${t.latin}" romanization may not match script (${rom.script} vs ${rom.latin})`)
  }
  const joined = foldForMatch(tokens.map((t) => t.text).join(' '), lang)
  if (joined !== foldForMatch(text, lang)) error(where, `tokens do not add up to the sentence text: "${tokens.map((t) => t.text).join(' ')}" vs "${text}"`)
  const joinedLatin = foldLatin(tokens.map((t) => t.latin).join(' '))
  if (joinedLatin !== foldLatin(latin)) error(where, `token romanizations do not add up to the sentence romanization`)
}

/* ---------- evidence ---------- */

interface EvidenceOut {
  level: EvidenceLevel | 'native-reviewed'
  checks: string[]
  audio?: string
  ipa?: string
}
const evidence: Record<string, EvidenceOut> = {}

interface Review {
  key: string
  verdict: 'correct' | 'incorrect'
  reviewer: string
  date: string
  comment?: string
}
const reviewsDir = path.join(ROOT, 'src/content/reviews')
const reviews: Review[] = fs.existsSync(reviewsDir)
  ? fs
      .readdirSync(reviewsDir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(reviewsDir, f), 'utf8')).reviews ?? []) as Review[])
  : []
const latestReview = new Map<string, Review>()
for (const r of reviews.sort((a, b) => a.date.localeCompare(b.date))) latestReview.set(r.key, r)

function applyReview(key: string, ev: EvidenceOut): EvidenceOut {
  const r = latestReview.get(key)
  if (!r) return ev
  if (r.verdict === 'correct') return { ...ev, level: 'native-reviewed', checks: [`Native speaker (${r.reviewer})`, ...ev.checks] }
  warn(key, `native reviewer marked this incorrect: ${r.comment ?? ''}`)
  return { ...ev, level: 'none', checks: [`Flagged by native speaker (${r.reviewer})`, ...ev.checks] }
}

/* ---------- concepts ---------- */

for (const { file, c } of lexicon) {
  const where = `${file} concept "${c.id}"`
  checkUnit(where, c.unit)
  if (!c.ckb) warn(where, 'no Sorani entry')
  if (!c.fa) warn(where, 'no Persian entry')
  if (c.pos !== 'phrase' && !swedishMatches(c)) warn(where, `Swedish gloss "${c.gloss.sv}" not found among Wiktionary's Swedish translations of "${c.gloss.en}" (may still be right)`)
  for (const lang of LANGS) {
    const entry = c[lang]
    if (!entry) continue
    const forms: Form[] = [entry.primary, ...(entry.variants ?? [])]
    for (const f of [...forms, entry.plural, entry.presentStem, entry.pastStem].filter(Boolean) as Form[]) {
      lintForm(`${where} ${lang}`, f, lang)
      const rom = checkRomanization(f.script, f.latin, lang)
      if (!rom.ok) warn(`${where} ${lang}`, `romanization "${f.latin}" may not match "${f.script}" (${rom.script} vs ${rom.latin})`)
    }
    const ev = formEvidence(entry.primary, lang, conceptGlossesEn(c))
    const level = evidenceLevel(ev)
    const checks: string[] = []
    if (ev.translationTable) checks.push('Wiktionary translation table')
    if (ev.entryGlossMatch) checks.push('Wiktionary dictionary entry')
    else if (ev.entryExists) checks.push('Wiktionary entry exists (different sense)')
    if (ev.tatoebaHits) checks.push(`Used in ${ev.tatoebaHits} Tatoeba sentence${ev.tatoebaHits > 1 ? 's' : ''}`)
    if (lang === 'fa' && ev.romanizationMatchesWiktionary === false)
      warn(`${where} fa`, `romanization "${entry.primary.latin}" differs from Wiktionary's`)
    if (level === 'none') warn(`${where} ${lang}`, `no reference source confirms "${entry.primary.script}"; needs native review`)
    const key = `concept:${lang}:${c.id}`
    evidence[key] = applyReview(key, { level, checks, audio: ev.wiktionaryAudio, ipa: ev.wiktionaryIpa })
  }
}

/* ---------- sentences ---------- */

const tatoebaText: Record<TargetLang, Map<string, number>> = { ckb: new Map(), fa: new Map() }
for (const lang of LANGS)
  for (const [id, text] of reference().tatoeba[lang].pairs) tatoebaText[lang].set(foldForMatch(text, lang), id)

function sentenceEvidence(form: SentenceForm, lang: TargetLang): EvidenceOut {
  const checks: string[] = []
  const tatoebaId = tatoebaText[lang].get(foldForMatch(form.text, lang))
  if (tatoebaId) checks.push(`Tatoeba sentence #${tatoebaId}`)
  const known = form.tokens.filter((t) => {
    const k = foldForMatch(t.text, lang)
    return (reference().tatoeba[lang].tokens[k] ?? 0) > 0 || (reference().wikt[lang][k]?.length ?? 0) > 0
  }).length
  const ratio = known / form.tokens.length
  checks.push(`${known}/${form.tokens.length} words attested in references`)
  const level: EvidenceLevel = tatoebaId ? 'strong' : ratio === 1 ? 'good' : ratio >= 0.6 ? 'attested' : 'none'
  return { level, checks }
}

for (const { file, s } of sentenceEntries) {
  const where = `${file} sentence "${s.id}"`
  checkUnit(where, s.unit)
  for (const lang of LANGS) {
    const form = s[lang]
    if (!form) continue
    lintForm(`${where} ${lang}`, form, lang)
    checkTokens(`${where} ${lang}`, form.tokens, form.text, form.latin, lang)
    for (const g of form.grammar ?? []) if (!grammarIds.has(g)) error(where, `unknown grammar point "${g}"`)
    for (const alt of [...(form.alternatives ?? []), ...(form.colloquial ? [form.colloquial] : [])]) lintForm(`${where} ${lang} alt`, alt, lang)
    for (const d of form.distractors ?? []) lintForm(`${where} ${lang} distractor`, d, lang)
    const key = `sentence:${lang}:${s.id}`
    const ev = sentenceEvidence(form, lang)
    if (ev.level === 'none') warn(`${where} ${lang}`, 'most words are not attested in reference data; needs native review')
    evidence[key] = applyReview(key, ev)
  }
}

/* ---------- Q&A ---------- */

for (const { file, q } of qaEntries) {
  const where = `${file} qa "${q.id}"`
  checkUnit(where, q.unit)
  for (const lang of LANGS) {
    const form = q[lang]
    if (!form) continue
    lintForm(`${where} ${lang} question`, form.question, lang)
    for (const v of [form.question.colloquial, ...(form.question.alternatives ?? [])])
      if (v) lintForm(`${where} ${lang} question variant`, v, lang)
    if (form.question.tokens) checkTokens(`${where} ${lang} question`, form.question.tokens, form.question.text, form.question.latin, lang)
    for (const a of form.answers) {
      lintForm(`${where} ${lang} answer`, { text: withoutSlots(a.text), latin: withoutSlots(a.latin) }, lang)
      for (const slot of a.text.match(/\{(\w+)\}/g) ?? []) {
        const name = slot.slice(1, -1)
        if (!form.slots?.[name]) error(where, `answer uses ${slot} but no slot values are defined`)
      }
      if (a.tokens) checkTokens(`${where} ${lang} answer`, a.tokens, a.text, a.latin, lang)
    }
    for (const [name, values] of Object.entries(form.slots ?? {}))
      for (const v of values) lintForm(`${where} ${lang} slot {${name}}`, v, lang)
    const qe = sentenceEvidence({ ...form.question, tokens: form.question.tokens ?? [], sources: form.sources }, lang)
    evidence[`qa:${lang}:${q.id}`] = applyReview(`qa:${lang}:${q.id}`, form.question.tokens ? qe : { level: 'none', checks: [] })
  }
}

/* ---------- grammar ---------- */

for (const { file, g } of grammarEntries) {
  const where = `${file} grammar "${g.id}"`
  checkUnit(where, g.unit)
  for (const ex of g.examples) {
    lintForm(`${where} example`, ex, g.lang)
    if (ex.tokens) checkTokens(`${where} example`, ex.tokens, ex.text, ex.latin, g.lang)
  }
}

/* ---------- output ---------- */

const generated = path.join(ROOT, 'src/content/generated')
fs.mkdirSync(generated, { recursive: true })
const sortedEvidence = Object.fromEntries(Object.entries(evidence).sort(([a], [b]) => a.localeCompare(b)))
fs.writeFileSync(path.join(generated, 'evidence.json'), JSON.stringify(sortedEvidence, null, 1) + '\n')

const levels = ['native-reviewed', 'strong', 'good', 'attested', 'none'] as const
const count = (prefix: string, lang: TargetLang, level: string) =>
  Object.entries(evidence).filter(([k, v]) => k.startsWith(`${prefix}:${lang}:`) && v.level === level).length

const errors = issues.filter((i) => i.severity === 'error')
const warnings = issues.filter((i) => i.severity === 'warning')

const perUnit = units.map((u) => {
  const n = (lang: TargetLang) => ({
    words: lexicon.filter(({ c }) => c.unit === u.id && c[lang]).length,
    sentences: sentenceEntries.filter(({ s }) => s.unit === u.id && s[lang]).length,
    qa: qaEntries.filter(({ q }) => q.unit === u.id && q[lang]).length,
    grammar: grammarEntries.filter(({ g }) => g.unit === u.id && g.lang === lang).length,
  })
  return { unit: u.id, ckb: n('ckb'), fa: n('fa') }
})

const report = [
  '# Content report',
  '',
  'Generated by `npm run content:check`. Do not edit by hand.',
  '',
  '## Verification evidence',
  '',
  '| Kind | Language | ' + levels.join(' | ') + ' |',
  '| --- | --- | ' + levels.map(() => '---').join(' | ') + ' |',
  ...(['concept', 'sentence', 'qa'] as const).flatMap((kind) =>
    LANGS.map((lang) => `| ${kind} | ${lang} | ${levels.map((l) => count(kind, lang, l)).join(' | ')} |`),
  ),
  '',
  '## Coverage per unit',
  '',
  '| Unit | ckb words | ckb sentences | ckb Q&A | ckb grammar | fa words | fa sentences | fa Q&A | fa grammar |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...perUnit.map(
    (u) =>
      `| ${u.unit} | ${u.ckb.words} | ${u.ckb.sentences} | ${u.ckb.qa} | ${u.ckb.grammar} | ${u.fa.words} | ${u.fa.sentences} | ${u.fa.qa} | ${u.fa.grammar} |`,
  ),
  '',
  `## Errors (${errors.length})`,
  '',
  ...errors.map((i) => `- **${i.where}**: ${i.message}`),
  '',
  `## Warnings (${warnings.length})`,
  '',
  ...warnings.map((i) => `- ${i.where}: ${i.message}`),
  '',
].join('\n')
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'docs/content-report.md'), report)

for (const i of errors) console.error(`ERROR  ${i.where}: ${i.message}`)
if (!quiet) for (const i of warnings) console.warn(`warn   ${i.where}: ${i.message}`)
console.log(
  `\n${lexicon.length} concepts, ${sentenceEntries.length} sentences, ${qaEntries.length} Q&A, ${grammarEntries.length} grammar points`,
)
for (const lang of LANGS)
  console.log(`  ${lang} words: ${levels.map((l) => `${l} ${count('concept', lang, l)}`).join(', ')}`)
console.log(`${errors.length} errors, ${warnings.length} warnings. Report: docs/content-report.md`)
process.exit(errors.length ? 1 : 0)
