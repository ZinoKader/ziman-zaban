import { EMPTY_PROGRESS, withReview, type Progress, type ReviewEntry } from '@/lib/progress'
import { cardKey, Rating, type CardKey, type Grade } from '@/lib/srs'
import { deviceStorage } from '@/store/device-storage'
import { parseBackup } from './backup'
import { importDeviceProgress, IMPORTED_KEY, parseDeviceProgress } from './device-import'
import { saveProgress } from './progress-api'
import { cardFromRow, cardInsert, dayInserts, progressFromRows, progressRows, type CardRow } from './rows'

const water = cardKey('ckb', 'recognition', 'water')
const waterFa = cardKey('fa', 'recall', 'water')
const at = (h: number) => new Date(2026, 2, 2, h)

function play(steps: [CardKey, Grade, Date][]) {
  const log: ReviewEntry[] = []
  let p: Progress = EMPTY_PROGRESS
  for (const [key, grade, now] of steps) {
    const r = withReview(p, key, grade, { ms: 1000, kind: 'typed', now })
    p = r.progress
    log.push(r.entry)
  }
  return { ...p, log }
}

const asRow = (insert: ReturnType<typeof cardInsert>, ts = (t: string) => t.replace('Z', '+00:00')): CardRow => ({
  ...insert,
  user_id: 'u',
  due: ts(insert.due),
  created_at: ts(insert.created_at!),
  last_review: insert.last_review ? ts(insert.last_review) : null,
})

describe('card rows', () => {
  it('round-trips a card through the row Postgres returns', () => {
    const { cards } = play([[water, Rating.Good, at(9)], [water, Rating.Good, at(10)]])
    const card = cards[water]!
    const insert = cardInsert(water, card)
    expect(insert).toMatchObject({ lang: 'ckb', skill: 'recognition', item_id: 'water', reps: 2 })
    expect(cardFromRow(asRow(insert))).toEqual([water, card])
  })
})

describe('progressRows', () => {
  it('marks only the first review of a card as new', () => {
    const rows = progressRows(play([[water, Rating.Good, at(9)], [water, Rating.Again, at(10)]]), 'ckb')
    expect(rows.reviews!.map((r) => r.is_new)).toEqual([true, false])
    expect(rows.reviews![0]).toMatchObject({ lang: 'ckb', grade: Rating.Good, day: '2026-03-02', ms: 1000 })
  })

  it('files combined day stats without a language under the fallback', () => {
    const days = dayInserts(
      { '2026-01-01': { reviews: 5, correct: 4, newItems: 2, ms: 9000 }, '2026-03-02': { reviews: 2, correct: 2, newItems: 2, ms: 2000 } },
      { fa: { '2026-03-02': { reviews: 2, correct: 2, newItems: 2, ms: 2000 } } },
      'ckb',
    )
    expect(days).toEqual([
      { lang: 'ckb', day: '2026-01-01', reviews: 5, correct: 4, new_items: 2, ms: 9000 },
      { lang: 'fa', day: '2026-03-02', reviews: 2, correct: 2, new_items: 2, ms: 2000 },
    ])
  })
})

describe('progressFromRows', () => {
  it('sums both languages into the combined day stats and sorts medals', () => {
    const p = progressFromRows({
      cards: [],
      days: [
        { user_id: 'u', lang: 'ckb', day: '2026-03-02', reviews: 2, correct: 1, new_items: 1, ms: 3000 },
        { user_id: 'u', lang: 'fa', day: '2026-03-02', reviews: 1, correct: 1, new_items: 1, ms: 500 },
      ],
      medals: [
        { user_id: 'u', lang: 'ckb', words: 25, earned_at: '2026-03-03T10:00:00+00:00' },
        { user_id: 'u', lang: 'ckb', words: 10, earned_at: '2026-03-02T10:00:00+00:00' },
      ],
      reports: [],
    })
    expect(p.days).toEqual({ '2026-03-02': { reviews: 3, correct: 2, newItems: 2, ms: 3500 } })
    expect(p.medals.ckb!.map((m) => [m.words, m.at])).toEqual([
      [10, '2026-03-02T10:00:00.000Z'],
      [25, '2026-03-03T10:00:00.000Z'],
    ])
  })
})

describe('parseBackup', () => {
  it('reads an exported file and rebuilds per-language stats when it has none', () => {
    const full = play([[water, Rating.Good, at(9)], [waterFa, Rating.Good, at(10)]])
    const backup = parseBackup(JSON.stringify({ cards: full.cards, log: full.log, days: full.days }))
    expect(backup).toEqual({ ...full, reports: [], medals: {} })
  })

  it('rejects files that are not a backup', () => {
    expect(parseBackup('not json')).toBeNull()
    expect(parseBackup(JSON.stringify({ cards: [] }))).toBeNull()
  })
})

describe('importDeviceProgress', () => {
  const saved = () => {
    const full = play([[water, Rating.Good, at(9)]])
    return JSON.stringify({ state: { cards: full.cards, log: full.log, days: full.days, reports: [] }, version: 0 })
  }

  it('reads the persisted store format', () => {
    expect(parseDeviceProgress(saved())!.daysByLang.ckb).toEqual({ '2026-03-02': { reviews: 1, correct: 1, newItems: 1, ms: 1000 } })
    expect(parseDeviceProgress(null)).toBeNull()
  })

  it('sends the device progress once and leaves the device copy in place', async () => {
    localStorage.setItem('zz-progress', saved())
    vi.spyOn(deviceStorage, 'getItem').mockImplementation(async (name) => localStorage.getItem(name))
    expect(await importDeviceProgress('u', 'ckb', localStorage)).toBe(true)
    expect(saveProgress).toHaveBeenCalledTimes(1)
    expect(vi.mocked(saveProgress).mock.calls[0][0].reviews).toHaveLength(1)
    expect(localStorage.getItem(IMPORTED_KEY)).toContain('"userId":"u"')
    expect(await importDeviceProgress('u', 'ckb', localStorage)).toBe(false)
    expect(saveProgress).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('zz-progress')).toBe(saved())
  })

  it('marks a device with nothing saved as done without a request', async () => {
    vi.spyOn(deviceStorage, 'getItem').mockResolvedValue(null)
    expect(await importDeviceProgress('u', 'ckb', localStorage)).toBe(false)
    expect(saveProgress).not.toHaveBeenCalled()
    expect(localStorage.getItem(IMPORTED_KEY)).not.toBeNull()
  })
})
