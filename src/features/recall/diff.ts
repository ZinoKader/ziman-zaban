export type DiffOpType = 'equal' | 'missing' | 'extra'

export interface DiffOp {
  /** `missing`: in the expected text but not in the answer. `extra`: in the answer but not expected. */
  type: DiffOpType
  text: string
}

/**
 * Character-level diff of a learner's answer against the expected spelling,
 * based on the longest common subsequence of code points. Adjacent operations of
 * the same type are merged; at a substitution the extra (wrong) characters come
 * before the missing (right) ones.
 */
export function diffChars(answer: string, expected: string): DiffOp[] {
  const a = [...answer]
  const b = [...expected]
  const n = a.length
  const m = b.length
  // lcs[i][j] = length of the LCS of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  const push = (type: DiffOpType, ch: string) => {
    const last = ops[ops.length - 1]
    if (last?.type === type) last.text += ch
    else ops.push({ type, text: ch })
  }
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      push('equal', a[i++])
      j++
    } else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      push('extra', a[i++])
    } else {
      push('missing', b[j++])
    }
  }
  return ops
}

const ARABIC_LETTER = /[\u0620-\u064A\u066E-\u06D3\u06D5\u06FA-\u06FC\u06FF]/
/** Letters that never connect to the following letter (Persian and Sorani). */
const RIGHT_JOINING = /[\u0621-\u0625\u0627\u0629\u062F-\u0632\u0648\u0698\u0688-\u0699\u06C0-\u06CB\u06CF\u06D3\u06D5]/

/**
 * Whether two Arabic-script letters join, so that when they are rendered in separate
 * (differently coloured) spans a zero-width joiner is needed to keep their connected shapes.
 */
export function joinsNext(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false
  return ARABIC_LETTER.test(left) && !RIGHT_JOINING.test(left) && ARABIC_LETTER.test(right) && right !== '\u0621'
}

/** Share (0–1) of the expected characters that the answer got right. */
export function diffSimilarity(ops: DiffOp[]): number {
  let same = 0
  let expected = 0
  for (const op of ops) {
    const len = [...op.text].length
    if (op.type === 'equal') same += len
    if (op.type !== 'extra') expected += len
  }
  return expected ? same / expected : 0
}
