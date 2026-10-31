export type Inline = { kind: 'text' | 'bold' | 'code'; text: string }
export type Paragraph = Inline[]

const INLINE = /\*\*([^*]+?)\*\*|`([^`]+)`/g

/**
 * Parses the tiny explanation markup: paragraphs separated by blank lines,
 * `**bold**` and `` `code` ``. Anything else, including unbalanced markers, is plain text.
 */
export function parseMarkup(source: string): Paragraph[] {
  return source
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((p) => {
      const out: Inline[] = []
      let last = 0
      for (const m of p.matchAll(INLINE)) {
        if (m.index > last) out.push({ kind: 'text', text: p.slice(last, m.index) })
        out.push(m[1] !== undefined ? { kind: 'bold', text: m[1] } : { kind: 'code', text: m[2] })
        last = m.index + m[0].length
      }
      if (last < p.length) out.push({ kind: 'text', text: p.slice(last) })
      return out
    })
}

/** Plain text without markup, for teasers and labels. */
export function stripMarkup(source: string): string {
  return parseMarkup(source)
    .map((p) => p.map((i) => i.text).join(''))
    .join(' ')
}

/** The first sentence of an explanation, shortened to roughly `max` characters on a word boundary. */
export function teaser(source: string, max = 120): string {
  const plain = stripMarkup(source)
  const first = plain.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? plain
  if (first.length <= max) return first
  const cut = first.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:]+$/, '')}…`
}

// An Arabic-script run may span several words (and Arabic punctuation) so a phrase keeps its RTL order.
const SCRIPT_RUN =
  /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF](?:[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200C]|[\s.!:]+(?=[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]))*/g

export function splitScript(text: string): Array<{ script: boolean; text: string }> {
  const out: Array<{ script: boolean; text: string }> = []
  let last = 0
  for (const m of text.matchAll(SCRIPT_RUN)) {
    if (m.index > last) out.push({ script: false, text: text.slice(last, m.index) })
    out.push({ script: true, text: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ script: false, text: text.slice(last) })
  return out
}
