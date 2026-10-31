import { shuffle } from '@/lib/distractors'
import type { Letter } from './letters'

export interface QuizQuestion {
  letter: Letter
  /** Four letters, the answer among them, no two sharing a sound. */
  options: Letter[]
}

const sharesSound = (a: Letter, b: Letter) => a.latin.some((x) => b.latin.includes(x))

/** A short round of "which sound does this letter make?". Silent letters are left out. */
export function makeQuiz(letters: Letter[], count: number, random: () => number): QuizQuestion[] {
  const pool = letters.filter((x) => x.latin.length > 0)
  const picked: Letter[] = []
  for (const letter of shuffle(pool, random)) {
    if (picked.length >= count) break
    if (picked.some((p) => sharesSound(p, letter))) continue
    picked.push(letter)
  }
  return picked.map((letter) => {
    const wrong: Letter[] = []
    for (const other of shuffle(pool, random)) {
      if (wrong.length >= 3) break
      if (sharesSound(other, letter) || wrong.some((w) => sharesSound(w, other))) continue
      wrong.push(other)
    }
    return { letter, options: shuffle([letter, ...wrong], random) }
  })
}
