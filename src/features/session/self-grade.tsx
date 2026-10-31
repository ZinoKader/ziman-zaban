import { Button } from '@/components/ui/button'
import { common } from '@/i18n/common'
import { Rating, type Grade } from '@/lib/srs'

/**
 * Again / Hard / Good / Easy buttons for exercises the learner grades themselves
 * (e.g. after saying an answer out loud). Keys 1-4 work too.
 */
export function SelfGrade({ onGrade }: { onGrade: (g: Grade) => void }) {
  const s = common.use()
  const options: Array<{ g: Grade; label: string; className: string }> = [
    { g: Rating.Again, label: s.grades.again, className: 'border-destructive/50 text-destructive hover:bg-destructive/10' },
    { g: Rating.Hard, label: s.grades.hard, className: 'border-warning/60 hover:bg-warning/15' },
    { g: Rating.Good, label: s.grades.good, className: 'border-success/50 text-success hover:bg-success/10' },
    { g: Rating.Easy, label: s.grades.easy, className: 'border-primary/50 text-primary hover:bg-primary/10' },
  ]
  return (
    <div
      className="grid grid-cols-4 gap-2"
      onKeyDown={(e) => {
        const n = Number(e.key)
        if (n >= 1 && n <= 4) onGrade(options[n - 1].g)
      }}
    >
      {options.map((o, i) => (
        <Button key={o.g} variant="outline" size="xl" className={`border-2 px-2 ${o.className}`} onClick={() => onGrade(o.g)} autoFocus={i === 2}>
          {o.label}
        </Button>
      ))}
    </div>
  )
}
