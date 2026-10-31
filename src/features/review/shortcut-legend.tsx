import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { reviewStrings } from './strings'

export function ShortcutLegend() {
  const s = reviewStrings.use()
  const rows: Array<[string[], string]> = [
    [['A', '1'], s.keys.correct],
    [['X', '2'], s.keys.incorrect],
    [['S'], s.keys.skip],
    [['B', '←'], s.keys.back],
    [['Enter', 'Ctrl+Enter'], s.keys.save],
    [['Esc'], s.keys.cancel],
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([keys, label]) => (
        <div key={label} className="contents">
          <dt>
            <KbdGroup>
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </KbdGroup>
          </dt>
          <dd className="text-muted-foreground">{label}</dd>
        </div>
      ))}
    </dl>
  )
}
