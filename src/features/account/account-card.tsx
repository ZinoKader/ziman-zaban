import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { memberEmail, useAccount } from '@/store/account'
import { AccountForm, SignOutButton } from './account-form'
import { accountStrings as strings } from './strings'

export function AccountCard() {
  const s = strings.use()
  const email = memberEmail(useAccount())

  return (
    <Card id="account" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>{s.account}</CardTitle>
        <CardDescription>{email ? s.accountHint(email) : s.guestHint}</CardDescription>
      </CardHeader>
      <CardContent>{email ? <SignOutButton /> : <AccountForm id="settings-account" />}</CardContent>
    </Card>
  )
}
