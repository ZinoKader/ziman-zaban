import { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import * as api from '@/data/progress-api'
import { queryClient } from '@/data/query-client'
import { NO_SAVES, trackServerSaves, useServerSaves } from '@/data/server-saves'
import { cardKey, Rating } from '@/lib/srs'
import { record, seedProgress } from '@/test/progress'
import {
  EMPTY_PROGRESS,
  getProgress,
  PROGRESS_KEY,
  progressQuery,
  useAwardMedals,
  useImportBackup,
  useProgress,
  useReportProblem,
  useResetLanguage,
  type Progress,
} from './progress'

const water = cardKey('ckb', 'recognition', 'water')
const waterFa = cardKey('fa', 'recognition', 'water')
const now = new Date(2026, 2, 2, 9)

describe('useRecordReview', () => {
  it('shows the review at once and saves the review and the card', async () => {
    const { result } = renderHook(() => useProgress((p) => p.cards[water]?.reps ?? 0))
    const card = record(water, Rating.Good, { ms: 1200, kind: 'typed', now })
    expect(result.current).toBe(1)
    expect(getProgress().days['2026-03-02']).toEqual({ reviews: 1, correct: 1, newItems: 1, ms: 1200 })
    await waitFor(() => expect(api.saveProgress).toHaveBeenCalledTimes(1))
    expect(api.saveProgress).toHaveBeenCalledWith({
      reviews: [expect.objectContaining({ item_id: 'water', grade: Rating.Good, is_new: true, reviewed_at: now.toISOString() })],
      cards: [expect.objectContaining({ item_id: 'water', reps: 1, due: card.due })],
    })
  })

  it('keeps reviews made during a refetch', async () => {
    let release!: (p: Progress) => void
    vi.mocked(api.fetchProgress).mockImplementationOnce(() => new Promise((r) => (release = r)))
    const refetch = queryClient.refetchQueries({ queryKey: PROGRESS_KEY })
    await waitFor(() => expect(api.fetchProgress).toHaveBeenCalled())
    record(water, Rating.Good, { ms: 1, kind: 'typed', now })
    release(EMPTY_PROGRESS)
    await refetch
    expect(getProgress().cards[water]).toBeDefined()
  })

  it('takes the server copy when nothing changed meanwhile', async () => {
    const server = { ...EMPTY_PROGRESS, days: { '2026-03-01': { reviews: 4, correct: 4, newItems: 0, ms: 4000 } } }
    vi.mocked(api.fetchProgress).mockResolvedValueOnce(server)
    await queryClient.fetchQuery({ ...progressQuery, staleTime: 0 })
    expect(getProgress()).toEqual(server)
  })
})

describe('useAwardMedals', () => {
  it('saves only medals not earned before', async () => {
    seedProgress({ medals: { ckb: [{ words: 10, at: now.toISOString() }] } })
    const { result } = renderHook(() => useAwardMedals())
    act(() => result.current('ckb', [10, 25], now))
    expect(getProgress().medals.ckb!.map((m) => m.words)).toEqual([10, 25])
    await waitFor(() => expect(api.saveMedals).toHaveBeenCalledWith([{ lang: 'ckb', words: 25, earned_at: now.toISOString() }]))
    act(() => result.current('ckb', [10, 25], now))
    expect(api.saveMedals).toHaveBeenCalledTimes(1)
  })
})

describe('useReportProblem', () => {
  it('keeps the report and sends it', async () => {
    const { result } = renderHook(() => useReportProblem())
    act(() => result.current(water, 'Wrong vowel', now))
    expect(getProgress().reports).toEqual([{ key: water, message: 'Wrong vowel', at: now.toISOString() }])
    await waitFor(() =>
      expect(api.saveReport).toHaveBeenCalledWith({ item_key: water, message: 'Wrong vowel', created_at: now.toISOString() }),
    )
  })
})

describe('useResetLanguage', () => {
  it('clears one language and resets it on the server from that moment', async () => {
    record(water, Rating.Good, { ms: 1, kind: 'typed', now })
    record(waterFa, Rating.Good, { ms: 1, kind: 'typed', now })
    const { result } = renderHook(() => useResetLanguage())
    act(() => result.current('ckb', now))
    expect(Object.keys(getProgress().cards)).toEqual([waterFa])
    await waitFor(() => expect(api.resetLanguage).toHaveBeenCalledWith('ckb', now.toISOString()))
  })
})

describe('useImportBackup', () => {
  it('sends the backup and loads the result from the server', async () => {
    const medals = { fa: [{ words: 10, at: now.toISOString() }] }
    const merged = { ...EMPTY_PROGRESS, medals }
    vi.mocked(api.fetchProgress).mockResolvedValueOnce(merged)
    const { result } = renderHook(() => useImportBackup())
    await act(() => result.current({ ...EMPTY_PROGRESS, log: [], medals }, 'ckb'))
    expect(api.saveProgress).toHaveBeenCalledWith(
      expect.objectContaining({ medals: [{ lang: 'fa', words: 10, earned_at: now.toISOString() }] }),
    )
    expect(getProgress()).toEqual(merged)
  })
})

describe('trackServerSaves', () => {
  it('counts pending saves, successes and failures of progress saves only', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    useServerSaves.setState({ ...NO_SAVES })
    const stop = trackServerSaves(client, PROGRESS_KEY, useServerSaves, () => now)
    const build = (mutationKey: readonly unknown[], mutationFn: () => Promise<void>) =>
      client.getMutationCache().build(client, { mutationKey, mutationFn })

    let finish!: () => void
    const running = build(PROGRESS_KEY, () => new Promise<void>((r) => (finish = r))).execute(undefined)
    await waitFor(() => expect(useServerSaves.getState().pending).toBe(1))
    finish()
    await running
    expect(useServerSaves.getState()).toMatchObject({ pending: 0, saves: 1, failed: false, lastSavedAt: now.toISOString() })

    await build(PROGRESS_KEY, () => Promise.reject(new Error('down')))
      .execute(undefined)
      .catch(() => {})
    expect(useServerSaves.getState()).toMatchObject({ pending: 0, saves: 1, failed: true })

    await build(['other'], () => Promise.resolve()).execute(undefined)
    expect(useServerSaves.getState().saves).toBe(1)
    stop()
  })
})
