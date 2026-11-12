import { act, renderHook } from '@testing-library/react'
import { EMPTY_PROGRESS, setProgress, useRecordReview, type Progress, type RecordReview } from '@/store/progress'

export function seedProgress(patch: Partial<Progress> = {}) {
  setProgress({ ...EMPTY_PROGRESS, ...patch })
}

export function patchProgress(patch: Partial<Progress> | ((p: Progress) => Partial<Progress>)) {
  act(() => setProgress((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })))
}

export const record: RecordReview = (key, grade, meta) => {
  const { result, unmount } = renderHook(() => useRecordReview())
  let card!: ReturnType<RecordReview>
  act(() => {
    card = result.current(key, grade, meta)
  })
  unmount()
  return card
}
