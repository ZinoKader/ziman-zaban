import { Settings, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { memberEmail, useAccount } from '@/store/account'
import { useProgress } from '@/store/progress'
import { AccountForm, SignOutButton } from './account-form'
import { accountStrings as strings } from './strings'

export function AccountMenu() {
  const s = strings.use()
  const [open, setOpen] = useState(false)
  const account = useAccount()
  const email = memberEmail(account)
  const practised = useProgress((p) => Object.keys(p.cards).length > 0)
  const nudge = !email && practised
  const close = () => setOpen(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {email ? (
          <button
            type="button"
            aria-label={s.menuMember(email)}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold uppercase text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {email[0]}
          </button>
        ) : (
          <Button variant="outline" size="sm" aria-label={s.menuGuest} className="relative shrink-0 max-sm:px-2">
            <UserRound />
            <span className="hidden sm:inline">{s.signIn}</span>
            {nudge && <span aria-hidden className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] gap-4 p-4">
        {email ? (
          <>
            <div>
              <p className="font-medium">{s.signedIn}</p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="ghost" asChild className="justify-start">
                <Link to="/settings#account" onClick={close}>
                  <Settings /> {s.settingsLink}
                </Link>
              </Button>
              <SignOutButton onDone={close} />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <p className="font-medium">{s.keepTitle}</p>
              <p className="text-sm text-muted-foreground">{s.keepHint}</p>
            </div>
            <AccountForm id="menu-account" compact autoFocus onDone={close} />
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
