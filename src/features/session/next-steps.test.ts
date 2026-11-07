import { conceptsFor } from '@/content'
import { moduleStatus, type Cards } from '@/lib/curriculum'
import { cardKey, Rating, reviewCard } from '@/lib/srs'
import { nextSteps } from './next-steps'

const q = { sessionSize: 15, newPerSession: 5 }
const words = conceptsFor('ckb')

describe('nextSteps', () => {
  it('suggests new words in the same module even when a normal session would be all reviews', () => {
    const past = new Date(Date.now() - 30 * 86_400_000)
    const cards: Cards = Object.fromEntries(
      words.slice(0, 20).map((w) => [cardKey('ckb', 'recognition', w.id), reviewCard(undefined, Rating.Good, past)]),
    )
    const steps = nextSteps('recognition', 'ckb', cards, q)
    expect(steps.learnNew).toEqual({ skill: 'recognition', count: 5 })
    expect(steps.reviews).toBe(15)
  })

  it('points to the next module with new items when this one has none', () => {
    const now = new Date()
    const learned = reviewCard(undefined, Rating.Easy, now)
    const cards: Cards = Object.fromEntries(words.map((w) => [cardKey('ckb', 'recognition', w.id), learned]))
    const steps = nextSteps('recognition', 'ckb', cards, q, now)
    expect(steps.reviews).toBe(0)
    expect(steps.learnNew?.skill).not.toBe('recognition')
    const target = steps.learnNew!.skill
    expect(steps.learnNew!.count).toBe(Math.min(moduleStatus(target, 'ckb', cards, now).available, 5))
  })
})
