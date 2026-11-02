import en from '../../../CHANGELOG.md?raw'
import sv from '../../../CHANGELOG.sv.md?raw'
import { changelog, hasUnseen, latestRelease, parseChangelog, unseenCount } from './changelog'

describe('parseChangelog', () => {
  it('reads dated headings and area-prefixed bullets, ignoring everything else', () => {
    const md = '# Changelog\n\nIntro text.\n\n## 2026-11-02\n\n- Recall: four options.\n- A change with no area.\n\n## 2026-10-30\n\n- Q&A: fewer new words.\n'
    expect(parseChangelog(md)).toEqual([
      { date: '2026-11-02', changes: [{ area: 'Recall', text: 'four options.' }, { area: null, text: 'A change with no area.' }] },
      { date: '2026-10-30', changes: [{ area: 'Q&A', text: 'fewer new words.' }] },
    ])
  })
})

describe('unseen changes', () => {
  it('counts changes newer than the last one seen', () => {
    const releases = parseChangelog('## 2026-11-02\n- A: x\n- B: y\n## 2026-10-30\n- C: z\n')
    expect(unseenCount(null, releases)).toBe(3)
    expect(unseenCount('2026-10-30', releases)).toBe(2)
    expect(unseenCount('2026-11-02', releases)).toBe(0)
  })

  it('flags the newest entry until it has been seen', () => {
    expect(hasUnseen(null)).toBe(true)
    expect(hasUnseen(latestRelease)).toBe(false)
    expect(hasUnseen('2000-01-01')).toBe(true)
  })
})

describe('CHANGELOG.md and CHANGELOG.sv.md', () => {
  it('have at least one entry, newest first, with unique dates', () => {
    const dates = changelog.en.map((r) => r.date)
    expect(dates.length).toBeGreaterThan(0)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(new Set(dates).size).toBe(dates.length)
  })

  it('have the same dates and the same number of bullets per date', () => {
    const outline = (lang: 'en' | 'sv') => changelog[lang].map((r) => [r.date, r.changes.length])
    expect(outline('sv')).toEqual(outline('en'))
  })

  it('start every bullet with an area', () => {
    for (const lang of ['en', 'sv'] as const) {
      expect(changelog[lang].flatMap((r) => r.changes).filter((c) => !c.area)).toEqual([])
    }
  })

  it.each([
    ['en', en],
    ['sv', sv],
  ])('%s has no LLM language (see .cursor/skills/writing/SKILL.md)', (_, md) => {
    const banned =
      /—|\b(delve|leverag|harness|utili[sz]|enhanc|elevat|bolster|streamlin|showcas|underscor|foster|empower|seamless|robust|dependable|crucial|pivotal|comprehensive|holistic|multifaceted|intricate|meticulous|vibrant|groundbreaking|landscape|tapestry|testament|additionally|furthermore|moreover|unlock|unleash|ensur|this matters|not just|not simply|rather than|sömlös|avgörande|banbrytande|inte bara)/gi
    expect(md.match(banned) ?? []).toEqual([])
  })
})
