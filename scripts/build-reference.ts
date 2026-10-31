/**
 * Builds the compact reference indices in `reference/` from raw open datasets.
 * Run `scripts/fetch-sources.sh` first. See reference/README.md for licenses.
 *
 *   npx tsx scripts/build-reference.ts [rawDir]
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { canonicalizePersian, canonicalizeSorani, foldForMatch } from '../src/lib/script/normalize'

const RAW = process.argv[2] ?? process.env.RAW_DIR ?? path.resolve('raw')
const OUT = path.resolve('reference')
fs.mkdirSync(OUT, { recursive: true })

type Lang = 'fa' | 'ckb'
const canon = (w: string, lang: Lang) => (lang === 'fa' ? canonicalizePersian(w) : canonicalizeSorani(w))

async function* lines(file: string) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity })
  for await (const line of rl) if (line) yield line
}

function write(name: string, data: unknown) {
  const file = path.join(OUT, name)
  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`wrote ${name} (${(fs.statSync(file).size / 1024).toFixed(0)} kB)`)
}

/* English Wiktionary translation tables: English headword -> fa / ckb / sv. */
interface EnSense {
  pos: string
  sense: string
  fa?: Array<[string, string]>
  ckb?: Array<[string, string]>
  sv?: string[]
}

async function buildEnglishTranslations() {
  const out: Record<string, EnSense[]> = {}
  for await (const line of lines(path.join(RAW, 'en-translations.jsonl'))) {
    const e = JSON.parse(line) as {
      word: string
      pos: string
      t: Array<{ code?: string; lang_code?: string; word?: string; roman?: string; sense?: string }>
    }
    const bySense = new Map<string, EnSense>()
    for (const t of e.t) {
      const code = t.code ?? t.lang_code
      if (!t.word || !code) continue
      const sense = (t.sense ?? '').slice(0, 80)
      let s = bySense.get(sense)
      if (!s) bySense.set(sense, (s = { pos: e.pos, sense }))
      if (code === 'sv') (s.sv ??= []).includes(t.word) || s.sv.push(t.word)
      else if (code === 'fa' || code === 'ckb') {
        const w = canon(t.word, code)
        const list = (s[code] ??= [])
        if (!list.some(([x, r]) => x === w && r === (t.roman ?? ''))) list.push([w, t.roman ?? ''])
      }
    }
    const senses = [...bySense.values()].filter((s) => s.fa || s.ckb)
    if (senses.length) (out[e.word] ??= []).push(...senses)
  }
  write('en-translations.json', out)
}

/* Wiktionary entries for Persian / Central Kurdish words, keyed by folded spelling. */
interface WiktEntry {
  w: string
  pos: string
  r: string[]
  g: string[]
  ipa?: string
  audio?: string
}

async function buildWiktionary(lang: Lang, file: string) {
  const out: Record<string, WiktEntry[]> = {}
  for await (const line of lines(path.join(RAW, file))) {
    const e = JSON.parse(line) as {
      word: string
      pos: string
      forms?: Array<{ form: string; tags?: string[] }>
      senses?: Array<{ glosses?: string[]; tags?: string[] }>
      sounds?: Array<{ ipa?: string; tags?: string[]; mp3_url?: string; ogg_url?: string }>
    }
    const r = (e.forms ?? []).filter((f) => f.tags?.includes('romanization')).map((f) => f.form)
    const g = (e.senses ?? [])
      .filter((s) => !s.tags?.includes('form-of'))
      .flatMap((s) => s.glosses ?? [])
      .slice(0, 6)
    if (!g.length) continue
    const iranIpa = e.sounds?.find((s) => s.ipa && s.tags?.includes('Iran'))?.ipa
    const ipa = iranIpa ?? e.sounds?.find((s) => s.ipa)?.ipa
    const audio = e.sounds?.find((s) => s.mp3_url && (lang === 'ckb' || !s.tags || s.tags.includes('Iran')))?.mp3_url
    const w = canon(e.word, lang)
    const key = foldForMatch(w, lang)
    const entry: WiktEntry = { w, pos: e.pos, r, g }
    if (ipa) entry.ipa = ipa
    if (audio) entry.audio = audio
    ;(out[key] ??= []).push(entry)
  }
  write(`${lang}-wiktionary.json`, out)
}

/* Tatoeba: sentence pairs with English, and a token frequency list for attestation checks. */
async function buildTatoeba(lang: Lang, code: string) {
  const sentences = new Map<number, string>()
  for await (const line of lines(path.join(RAW, `${code}_sentences.tsv`))) {
    const [id, , text] = line.split('\t')
    const t = lang === 'ckb' ? canonicalizeSorani(text, { legacy: true }) : canonicalizePersian(text)
    sentences.set(Number(id), t)
  }
  const links: Array<[number, number]> = []
  for await (const line of lines(path.join(RAW, `${code}-eng_links.tsv`))) {
    const [a, b] = line.split('\t').map(Number)
    links.push([a, b])
  }
  const engIds = new Set(links.map(([, b]) => b))
  const eng = new Map<number, string>()
  for await (const line of lines(path.join(RAW, 'eng_sentences.tsv'))) {
    const tab = line.indexOf('\t')
    const id = Number(line.slice(0, tab))
    if (engIds.has(id)) eng.set(id, line.slice(line.indexOf('\t', tab + 1) + 1))
  }
  const pairs: Array<[number, string, string]> = []
  for (const [a, b] of links) {
    const t = sentences.get(a)
    const en = eng.get(b)
    if (t && en) pairs.push([a, t, en])
  }
  const tokens: Record<string, number> = {}
  for (const t of sentences.values()) {
    for (const tok of t.split(/[\s\u200C.,!?;:،؛؟«»"()]+/)) {
      if (!tok) continue
      const k = foldForMatch(tok, lang)
      if (k) tokens[k] = (tokens[k] ?? 0) + 1
    }
  }
  write(`tatoeba-${lang}.json`, { sentenceCount: sentences.size, pairs, tokens })
}

await buildEnglishTranslations()
await buildWiktionary('fa', 'fa-wikt.jsonl')
await buildWiktionary('ckb', 'ckb-wikt.jsonl')
await buildTatoeba('fa', 'pes')
await buildTatoeba('ckb', 'ckb')
