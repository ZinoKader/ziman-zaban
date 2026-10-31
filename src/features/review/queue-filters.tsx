import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { units } from '@/content'
import { LEVELS, type Level } from '@/content/types'
import { useLocalize } from '@/i18n'
import { REVIEW_KINDS, type QueueFilters as Filters, type ReviewKind } from './queue'
import { reviewStrings } from './strings'

interface QueueFiltersProps {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
}

export function QueueFilters({ filters, onChange }: QueueFiltersProps) {
  const s = reviewStrings.use()
  const l = useLocalize()
  return (
    <div className="space-y-2" role="group" aria-label={s.filters}>
      <div className="grid grid-cols-3 gap-2">
        <Select value={filters.kind} onValueChange={(v) => onChange({ kind: v as ReviewKind | 'all' })}>
          <SelectTrigger className="w-full" aria-label={s.kindLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['all', ...REVIEW_KINDS] as const).map((k) => (
              <SelectItem key={k} value={k}>
                {s.kinds[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.unit} onValueChange={(v) => onChange({ unit: v })}>
          <SelectTrigger className="w-full" aria-label={s.unitLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{s.allUnits}</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.emoji} {l(u.title)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.level} onValueChange={(v) => onChange({ level: v as Level | 'all' })}>
          <SelectTrigger className="w-full" aria-label={s.levelLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{s.allLevels}</SelectItem>
            {LEVELS.map((lv) => (
              <SelectItem key={lv} value={lv}>
                {lv}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-normal">
        <Switch checked={filters.unreviewedOnly} onCheckedChange={(v) => onChange({ unreviewedOnly: v })} />
        {s.unreviewedOnly}
      </Label>
    </div>
  )
}
