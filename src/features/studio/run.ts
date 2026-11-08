/** Where the speaker is in a run of prompts. `history` has one entry per step taken, so "Back" can undo it. */
export interface RunState {
  index: number
  history: Array<{ index: number; recorded: boolean }>
}

export const startRun = (): RunState => ({ index: 0, history: [] })

export function recorded(s: RunState): RunState {
  return { index: s.index + 1, history: [...s.history, { index: s.index, recorded: true }] }
}

export function skipped(s: RunState): RunState {
  return { index: s.index + 1, history: [...s.history, { index: s.index, recorded: false }] }
}

/** Goes back one step. `undo` is the prompt whose take should be deleted, if that step recorded one. */
export function back(s: RunState): { state: RunState; undo: number | null } {
  const last = s.history.at(-1)
  if (!last) return { state: s, undo: null }
  return { state: { index: last.index, history: s.history.slice(0, -1) }, undo: last.recorded ? last.index : null }
}

export function countRecorded(s: RunState): number {
  return s.history.filter((h) => h.recorded).length
}
