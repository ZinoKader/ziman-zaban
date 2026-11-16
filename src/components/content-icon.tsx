import type { LucideProps } from 'lucide-react'
import { ICONS, type IconName } from '@/content/icons'

/** The icon a content file names, drawn as decoration next to its text. */
export function ContentIcon({ name, ...props }: { name: IconName } & LucideProps) {
  const Icon = ICONS[name]
  return <Icon aria-hidden {...props} />
}
