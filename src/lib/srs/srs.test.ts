import {
  cardKey,
  gradeOutcome,
  isDue,
  isLearned,
  newCard,
  parseCardKey,
  Rating,
  retrievability,
  reviewCard,
  State,
  strength,
  type Grade,
  type Outcome,
  type StoredCard,
} from './index'

const DAY = 86_400_000
const T0 = new Date('2026-03-01T09:00:00Z')
const at = (days: number) => new Date(T0.getTime() + days * DAY)
const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY

describe('cardKey / parseCardKey', () => {
  it('round-trips', () => {
    expect(cardKey('ckb', 'recognition', 'water')).toBe('ckb:recognition:water')
    expect(parseCardKey(cardKey('fa', 'response', 'qa-name'))).toEqual({ lang: 'fa', skill: 'response', itemId: 'qa-name' })
  })

  it('keeps colons inside item ids', () => {
    const key = cardKey('fa', 'construction', 'unit:2:my-name')
    expect(parseCardKey(key)).toEqual({ lang: 'fa', skill: 'construction', itemId: 'unit:2:my-name' })
  })
})

describe('gradeOutcome', () => {
  const base: Outcome = { match: 'exact', hintsUsed: 0, attempts: 1, responseMs: 8000, fastMs: 5000 }
  const g = (o: Partial<Outcome>) => gradeOutcome({ ...base, ...o })

  it('wrong or unanswered is Again', () => {
    expect(g({ match: 'wrong' })).toBe(Rating.Again)
    expect(g({ match: null })).toBe(Rating.Again)
  })

  it('needing a second attempt is Again, even when the final answer was right', () => {
    expect(g({ attempts: 2 })).toBe(Rating.Again)
    expect(g({ attempts: 3, responseMs: 100 })).toBe(Rating.Again)
  })

  it('a typo or a hint is Hard', () => {
    expect(g({ match: 'typo' })).toBe(Rating.Hard)
    expect(g({ match: 'typo', responseMs: 100 })).toBe(Rating.Hard)
    expect(g({ hintsUsed: 1 })).toBe(Rating.Hard)
    expect(g({ match: 'close', hintsUsed: 2, responseMs: 100 })).toBe(Rating.Hard)
  })

  it('a clean answer is Good; Easy only when also faster than fastMs', () => {
    expect(g({})).toBe(Rating.Good)
    expect(g({ match: 'close' })).toBe(Rating.Good)
    expect(g({ responseMs: 5000 })).toBe(Rating.Good)
    expect(g({ responseMs: 4999 })).toBe(Rating.Easy)
    expect(g({ match: 'close', responseMs: 1000 })).toBe(Rating.Easy)
  })

  it('a slow-threshold of 0 never gives Easy (how multiple choice can cap at Good)', () => {
    expect(g({ responseMs: 1, fastMs: 0 })).toBe(Rating.Good)
  })

  it('self grades pass through, but a hint caps them at Hard', () => {
    expect(g({ match: null, selfGrade: Rating.Easy })).toBe(Rating.Easy)
    expect(g({ match: null, selfGrade: Rating.Again })).toBe(Rating.Again)
    expect(g({ match: null, selfGrade: Rating.Good, hintsUsed: 1 })).toBe(Rating.Hard)
    expect(g({ match: null, selfGrade: Rating.Again, hintsUsed: 1 })).toBe(Rating.Again)
  })
})

/** Reviews a card every time it falls due, always with the same grade. */
function simulate(grade: Grade, reviews: number) {
  let card = reviewCard(undefined, grade, T0)
  const history = [{ now: T0, card }]
  for (let i = 1; i < reviews; i++) {
    const now = new Date(card.due)
    card = reviewCard(card, grade, now)
    history.push({ now, card })
  }
  return history
}

describe('reviewCard', () => {
  it('creates a card on first review', () => {
    const card = reviewCard(undefined, Rating.Good, T0)
    expect(card.reps).toBe(1)
    expect(card.createdAt).toBe(T0.toISOString())
    expect(card.last_review).toBe(T0.toISOString())
    expect(new Date(card.due).getTime()).toBeGreaterThan(T0.getTime())
  })

  it('keeps createdAt across reviews', () => {
    const [, , third] = simulate(Rating.Good, 3)
    expect(third.card.createdAt).toBe(T0.toISOString())
    expect(third.card.reps).toBe(3)
  })

  it('graduates with Good and then spaces reviews further and further apart', () => {
    const history = simulate(Rating.Good, 8)
    const review = history.filter((h) => h.card.state === State.Review)
    expect(review.length).toBeGreaterThanOrEqual(5)
    const intervals = review.map((h) => daysBetween(h.now, new Date(h.card.due)))
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
    expect(intervals.at(-1)!).toBeGreaterThan(30)
    expect(isLearned(review[0].card)).toBe(true)
  })

  it('caps intervals at about a year', () => {
    // ts-fsrs orders hard < good < easy by a day each after clamping, so the cap can be passed by 2 days.
    for (const grade of [Rating.Good, Rating.Easy] as const) {
      for (const h of simulate(grade, 15)) expect(daysBetween(h.now, new Date(h.card.due))).toBeLessThanOrEqual(367)
    }
  })

  it('Easy spaces reviews further than Good, Hard less', () => {
    const interval = (grade: Grade) => {
      const h = simulate(grade, 5).at(-1)!
      return daysBetween(h.now, new Date(h.card.due))
    }
    expect(interval(Rating.Easy)).toBeGreaterThan(interval(Rating.Good))
    expect(interval(Rating.Good)).toBeGreaterThan(interval(Rating.Hard))
  })

  it('Again on a review card is a lapse: relearning, due soon, lower stability', () => {
    const graduated = simulate(Rating.Good, 6).at(-1)!.card
    expect(graduated.state).toBe(State.Review)
    const now = new Date(graduated.due)
    const lapsed = reviewCard(graduated, Rating.Again, now)
    expect(lapsed.state).toBe(State.Relearning)
    expect(lapsed.lapses).toBe(graduated.lapses + 1)
    expect(lapsed.stability).toBeLessThan(graduated.stability)
    expect(daysBetween(now, new Date(lapsed.due))).toBeLessThan(1)
    expect(isLearned(lapsed)).toBe(true)
    expect(strength(lapsed)).toBe('learning')
  })

  it('works on a card that went through JSON (localStorage)', () => {
    const card = simulate(Rating.Good, 4).at(-1)!.card
    const copy = JSON.parse(JSON.stringify(card)) as StoredCard
    expect(copy).toEqual(card)
    const now = new Date(card.due)
    expect(reviewCard(copy, Rating.Good, now)).toEqual(reviewCard(card, Rating.Good, now))
    expect(reviewCard(copy, Rating.Again, now)).toEqual(reviewCard(card, Rating.Again, now))
  })

  it('stores dates as ISO strings', () => {
    const card = reviewCard(undefined, Rating.Good, T0)
    expect(card.due).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
    expect(card.last_review).toMatch(/Z$/)
    expect(newCard(T0).last_review).toBeUndefined()
  })
})

describe('isDue', () => {
  it('is due at and after the due time, not before', () => {
    const card = reviewCard(undefined, Rating.Good, T0)
    const due = new Date(card.due)
    expect(isDue(card, new Date(due.getTime() - 1))).toBe(false)
    expect(isDue(card, due)).toBe(true)
    expect(isDue(card, at(400))).toBe(true)
  })

  it('a brand-new card is due immediately', () => {
    expect(isDue(newCard(T0), T0)).toBe(true)
  })
})

describe('retrievability', () => {
  it('is 0 for new cards and falls over time after a review', () => {
    expect(retrievability(newCard(T0), T0)).toBe(0)
    const card = simulate(Rating.Good, 4).at(-1)!.card
    const reviewed = new Date(card.last_review!)
    const soon = retrievability(card, new Date(reviewed.getTime() + DAY))
    const later = retrievability(card, new Date(reviewed.getTime() + 60 * DAY))
    expect(soon).toBeGreaterThan(0.9)
    expect(later).toBeLessThan(soon)
    expect(later).toBeGreaterThan(0)
  })

  it('is about the requested retention (0.9) when the card falls due', () => {
    const card = simulate(Rating.Good, 5).at(-1)!.card
    expect(retrievability(card, new Date(card.due))).toBeCloseTo(0.9, 1)
  })
})

describe('isLearned / strength', () => {
  const card = (patch: Partial<StoredCard>): StoredCard => ({ ...newCard(T0), ...patch })

  it('buckets by FSRS state and stability', () => {
    expect(strength(undefined)).toBe('new')
    expect(strength(card({ state: State.New }))).toBe('new')
    expect(strength(card({ state: State.Learning, stability: 50 }))).toBe('learning')
    expect(strength(card({ state: State.Relearning, stability: 50 }))).toBe('learning')
    expect(strength(card({ state: State.Review, stability: 20.9 }))).toBe('young')
    expect(strength(card({ state: State.Review, stability: 21 }))).toBe('mature')
  })

  it('learned means graduated at least once', () => {
    expect(isLearned(undefined)).toBe(false)
    expect(isLearned(card({ state: State.New }))).toBe(false)
    expect(isLearned(card({ state: State.Learning, reps: 5 }))).toBe(false)
    expect(isLearned(card({ state: State.Review }))).toBe(true)
    expect(isLearned(card({ state: State.Relearning, lapses: 1 }))).toBe(true)
    expect(isLearned(card({ state: State.Relearning, lapses: 0 }))).toBe(false)
  })

  it('a long run of Good ends mature', () => {
    expect(strength(simulate(Rating.Good, 10).at(-1)!.card)).toBe('mature')
  })
})
