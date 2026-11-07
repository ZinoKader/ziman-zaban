import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { courseProgress } from '@/features/progress/progress-data'
import { longDate } from '@/features/progress/format'
import { dayKey, useProgress } from '@/store/progress'
import { useSettings } from '@/store/settings'
import { Medal } from './medal'
import { milestonesFor, tierOf } from './medals'
import { medalStrings } from './strings'

/** Every medal for one language: earned ones in colour with the date, the rest greyed out with how far to go. */
export function MedalShelf({ lang, showLanguage }: { lang: TargetLang; showLanguage?: boolean }) {
  const s = medalStrings.use()
  const c = common.use()
  const baseLang = useSettings((st) => st.baseLang)
  const cards = useProgress((st) => st.cards)
  const earned = useProgress((st) => st.medals[lang])
  const course = useMemo(() => courseProgress(lang, cards), [lang, cards])
  const milestones = milestonesFor(course.total)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{showLanguage ? `${s.title}: ${c.languagesShort[lang]}` : s.title}</CardTitle>
        <CardDescription>{s.hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-8">
          {milestones.map((words) => {
            const medal = earned?.find((m) => m.words === words)
            return (
              <li key={words} className="flex flex-col items-center gap-1.5 text-center">
                <Medal words={words} tier={tierOf(words, course.total)} wordsLabel={s.words} earned={!!medal} />
                <span className="sr-only">{s.medal(words)}</span>
                <span className="text-[0.7rem] leading-tight text-muted-foreground">
                  {medal
                    ? s.earnedOn(longDate(dayKey(new Date(medal.at)), baseLang))
                    : course.learned >= words
                      ? s.pending
                      : s.toGo(words - course.learned)}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
