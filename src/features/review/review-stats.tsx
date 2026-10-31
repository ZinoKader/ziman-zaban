import type { Decision } from './export'
import { computeStats, REVIEW_KINDS, type QueueItem } from './queue'
import { reviewStrings } from './strings'

export function ReviewStats({ queue, decisions }: { queue: QueueItem[]; decisions: Record<string, Decision> }) {
  const s = reviewStrings.use()
  const stats = computeStats(queue, decisions)
  const rows = [...REVIEW_KINDS, 'all'] as const
  return (
    <table className="w-full text-sm tabular-nums">
      <caption className="sr-only">{s.statsTitle}</caption>
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="pb-1.5 text-start font-medium">
            {s.statKind}
          </th>
          <th scope="col" className="pb-1.5 ps-3 text-end font-medium">
            {s.reviewed}
          </th>
          <th scope="col" className="pb-1.5 ps-3 text-end font-medium text-success">
            {s.correctCount}
          </th>
          <th scope="col" className="pb-1.5 ps-3 text-end font-medium text-destructive">
            {s.incorrectCount}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((k) => {
          const st = stats[k]
          return (
            <tr key={k} className={k === 'all' ? 'border-t font-semibold' : undefined}>
              <th scope="row" className="py-1 text-start font-normal">
                {k === 'all' ? s.total : s.kinds[k]}
              </th>
              <td className="py-1 ps-3 text-end">
                {st.reviewed}
                <span className="text-muted-foreground">/{st.total}</span>
              </td>
              <td className="py-1 ps-3 text-end">{st.correct}</td>
              <td className="py-1 ps-3 text-end">{st.incorrect}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
