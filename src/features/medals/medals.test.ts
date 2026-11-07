import { medalsToAward, milestonesFor, nextMilestone, tierOf } from './medals'

describe('medal milestones', () => {
  it('ends with the whole course and skips milestones beyond it', () => {
    expect(milestonesFor(120)).toEqual([10, 25, 50, 100, 120])
    expect(milestonesFor(300)).toEqual([10, 25, 50, 100, 150, 200, 250, 300])
  })

  it('gets shinier as the milestones grow', () => {
    expect(tierOf(10, 300)).toBe('bronze')
    expect(tierOf(50, 300)).toBe('silver')
    expect(tierOf(150, 300)).toBe('gold')
    expect(tierOf(300, 300)).toBe('star')
  })

  it('awards every milestone reached and not yet earned, lowest first', () => {
    expect(medalsToAward(9, 300, [])).toEqual([])
    expect(medalsToAward(60, 300, [])).toEqual([10, 25, 50])
    expect(medalsToAward(60, 300, [10, 25])).toEqual([50])
    expect(medalsToAward(60, 300, [10, 25, 50])).toEqual([])
  })

  it('names the next milestone, or none when all are earned', () => {
    expect(nextMilestone(0, 300, [])).toBe(10)
    expect(nextMilestone(60, 300, [10, 25, 50])).toBe(100)
    expect(nextMilestone(120, 120, milestonesFor(120))).toBeNull()
  })
})
