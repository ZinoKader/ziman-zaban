/**
 * Look things up in the reference data while writing content.
 *
 *   npm run ref -- water                  English word -> Persian / Sorani / Swedish (Wiktionary)
 *   npm run ref -- "to eat"
 *   npm run ref -- ئاو                    Sorani/Persian spelling -> Wiktionary entries + Tatoeba counts
 *   npm run ref -- --lang fa آب           only one language
 *   npm run ref -- --sentences ckb ئاو    Tatoeba sentences (with English) containing the word
 *   npm run ref -- --check ckb ئاو aw     check a romanization against the script
 */
import type { TargetLang } from '../src/content/types'
import { foldForMatch, isArabicScript } from '../src/lib/script/normalize'
import { checkRomanization } from '../src/lib/script/skeleton'
import { englishHeadwords, reference } from './lib/reference'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  if (i < 0) return undefined
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const only = flag('--lang') as TargetLang | undefined
const sentencesLang = flag('--sentences') as TargetLang | undefined
const checkLang = flag('--check') as TargetLang | undefined
const query = args.join(' ').trim()
if (!query) {
  console.log('usage: npm run ref -- <english word | target word> (see scripts/ref.ts)')
  process.exit(1)
}
const ref = reference()
const langs: TargetLang[] = only ? [only] : ['ckb', 'fa']

if (checkLang) {
  const [script, ...latin] = query.split(' ')
  const r = checkRomanization(script, latin.join(' '), checkLang)
  console.log(r.ok ? 'OK' : 'MISMATCH', `script=${r.script} latin=${r.latin}`)
} else if (sentencesLang) {
  const key = foldForMatch(query, sentencesLang)
  const hits = ref.tatoeba[sentencesLang].pairs.filter(([, t]) =>
    t.split(/[\s\u200C.,!?;:،؛؟]+/).some((tok) => foldForMatch(tok, sentencesLang) === key),
  )
  console.log(`${hits.length} Tatoeba ${sentencesLang} sentences contain "${query}"`)
  for (const [id, t, en] of hits.slice(0, 25)) console.log(`  #${id}  ${t}\n          ${en}`)
} else if (!isArabicScript(query)) {
  for (const h of englishHeadwords([query])) {
    const senses = ref.en[h]
    if (!senses) continue
    console.log(`\n== ${h}`)
    for (const s of senses) {
      console.log(`  [${s.pos}] ${s.sense}`)
      for (const l of langs) for (const [w, r] of s[l] ?? []) console.log(`     ${l.padEnd(3)} ${w}  (${r})`)
      if (s.sv?.length) console.log(`     sv  ${s.sv.join(', ')}`)
    }
  }
} else {
  for (const l of langs) {
    const key = foldForMatch(query, l)
    const entries = ref.wikt[l][key] ?? []
    const hits = ref.tatoeba[l].tokens[key] ?? 0
    console.log(`\n== ${l}: ${query}   tatoeba token count: ${hits}`)
    for (const e of entries) {
      console.log(`  [${e.pos}] ${e.w}  roman: ${e.r.join(' / ') || '-'}  ${e.ipa ?? ''}`)
      for (const g of e.g) console.log(`     - ${g}`)
      if (e.audio) console.log(`     audio: ${e.audio}`)
    }
    const backrefs = Object.entries(ref.en)
      .filter(([, ss]) => ss.some((s) => (s[l] ?? []).some(([w]) => foldForMatch(w, l) === key)))
      .map(([en]) => en)
    if (backrefs.length) console.log(`  listed as translation of: ${backrefs.slice(0, 20).join(', ')}`)
  }
}
