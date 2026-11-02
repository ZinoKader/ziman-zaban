import { ArrowRight, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/store/settings'
import { hasUnseen, latestRelease, unseenCount } from './changelog'
import { whatsNewStrings } from './strings'

export function WhatsNewBanner() {
  const s = whatsNewStrings.use()
  const seen = useSettings((st) => st.changelogSeen)
  const set = useSettings((st) => st.set)
  if (!hasUnseen(seen)) return null
  const markSeen = () => set({ changelogSeen: latestRelease })

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 ps-4 shadow-xs">
      <Sparkles className="size-5 shrink-0 text-primary" />
      <Link to="/whats-new" onClick={markSeen} className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{s.banner(unseenCount(seen))}</span>
        <span className="ms-2 inline-flex items-center gap-1 text-primary">
          {s.read} <ArrowRight className="size-3.5 rtl:rotate-180" />
        </span>
      </Link>
      <Button variant="ghost" size="icon" onClick={markSeen} aria-label={s.dismiss}>
        <X />
      </Button>
    </div>
  )
}
