import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS } from './queue'
import { useReview } from './store'

const reset = () => useReview.setState({ reviewer: '', lang: null, decisions: {}, filters: DEFAULT_FILTERS, cursor: {} })
const day = new Date(2026, 9, 31, 12)

describe('review store', () => {
  beforeEach(reset)

  it('stores the reviewer and language under zz-review', () => {
    useReview.getState().setup('  Aras ', 'ckb')
    expect(useReview.getState()).toMatchObject({ reviewer: 'Aras', lang: 'ckb' })
    const saved = JSON.parse(localStorage.getItem('zz-review')!)
    expect(saved.state).toMatchObject({ reviewer: 'Aras', lang: 'ckb' })
  })

  it('records a correct decision with reviewer and local date', () => {
    useReview.getState().setup('Aras', 'ckb')
    useReview.getState().approve('concept:ckb:water', day)
    expect(useReview.getState().decisions['concept:ckb:water']).toEqual({ verdict: 'correct', reviewer: 'Aras', date: '2026-10-31' })
  })

  it('requires a comment for an incorrect decision', () => {
    useReview.getState().setup('Aras', 'ckb')
    expect(() => useReview.getState().flag('concept:ckb:water', { issues: [], correctForm: ' ', note: '' }, day)).toThrow()
    expect(useReview.getState().decisions).toEqual({})
    useReview.getState().flag('concept:ckb:water', { issues: ['spelling'], correctForm: 'ئاو', note: '' }, day)
    expect(useReview.getState().decisions['concept:ckb:water']).toMatchObject({
      verdict: 'incorrect',
      date: '2026-10-31',
      comment: '[Spelling] Correct form: ئاو',
      correctForm: 'ئاو',
    })
  })

  it('lets the reviewer change and remove a decision', () => {
    const st = useReview.getState()
    st.setup('Aras', 'ckb')
    st.flag('concept:ckb:water', { issues: [], correctForm: '', note: 'odd' }, day)
    st.approve('concept:ckb:water', day)
    expect(useReview.getState().decisions['concept:ckb:water'].verdict).toBe('correct')
    expect(useReview.getState().decisions['concept:ckb:water'].comment).toBeUndefined()
    st.undo('concept:ckb:water')
    expect(useReview.getState().decisions).toEqual({})
  })

  it('imports a file without overwriting newer local decisions', () => {
    const st = useReview.getState()
    st.setup('Aras', 'ckb')
    st.approve('concept:ckb:water', day)
    const applied = st.importReviews([
      { key: 'concept:ckb:water', verdict: 'incorrect', reviewer: 'Aras', date: '2026-10-01', comment: 'old' },
      { key: 'concept:ckb:bread', verdict: 'incorrect', reviewer: 'Aras', date: '2026-10-01', comment: '[Meaning] — means food' },
    ])
    expect(applied).toBe(1)
    const d = useReview.getState().decisions
    expect(d['concept:ckb:water'].verdict).toBe('correct')
    expect(d['concept:ckb:bread']).toMatchObject({ verdict: 'incorrect', issues: ['meaning'], note: 'means food' })
  })

  it('clears one language only', () => {
    const st = useReview.getState()
    st.setup('Aras', 'ckb')
    st.approve('concept:ckb:water', day)
    st.approve('concept:fa:water', day)
    st.setCursor('ckb', 'concept:ckb:water')
    st.clear('ckb')
    expect(Object.keys(useReview.getState().decisions)).toEqual(['concept:fa:water'])
    expect(useReview.getState().cursor.ckb).toBeUndefined()
  })

  it('merges filter changes', () => {
    useReview.getState().setFilters({ kind: 'qa' })
    useReview.getState().setFilters({ unreviewedOnly: true })
    expect(useReview.getState().filters).toEqual({ ...DEFAULT_FILTERS, kind: 'qa', unreviewedOnly: true })
  })
})
