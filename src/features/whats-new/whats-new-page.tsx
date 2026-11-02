import { Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { longDate } from '@/features/progress/format'
import { useSettings } from '@/store/settings'
import { changelog, latestRelease } from './changelog'
import { whatsNewStrings } from './strings'

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

export function WhatsNewPage() {
  const s = whatsNewStrings.use()
  const baseLang = useSettings((st) => st.baseLang)
  const set = useSettings((st) => st.set)
  const releases = changelog[baseLang]

  useEffect(() => {
    if (latestRelease && useSettings.getState().changelogSeen !== latestRelease) set({ changelogSeen: latestRelease })
  }, [set])

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:py-10">
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold">{s.title}</h1>
          <p className="text-muted-foreground">{s.intro}</p>
        </div>
      </header>

      {releases.length === 0 && <p className="text-sm text-muted-foreground">{s.empty}</p>}

      {releases.map((release) => (
        <section key={release.date} aria-labelledby={`release-${release.date}`} className="space-y-3">
          <h2 id={`release-${release.date}`} className="text-lg font-semibold">
            <time dateTime={release.date}>{longDate(release.date, baseLang)}</time>
          </h2>
          <Card className="py-2">
            <CardContent className="px-0">
              <ul className="divide-y">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-4">
                    {change.area && (
                      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:w-32 sm:pt-0.5">
                        {change.area}
                      </span>
                    )}
                    <span className="text-sm leading-relaxed">{capitalize(change.text)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  )
}
