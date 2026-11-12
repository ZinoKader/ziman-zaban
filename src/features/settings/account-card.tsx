import { LogIn, LogOut, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authProblem } from '@/data/auth-problem'
import type { AuthOutcome } from '@/data/session'
import { useAccount, useCreateAccount, useSignIn, useSignOut } from '@/store/account'
import { settingsStrings as strings } from './strings'

type Mode = 'create' | 'sign-in'

function AccountForm() {
  const s = strings.use()
  const [mode, setMode] = useState<Mode>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const create = useCreateAccount()
  const signIn = useSignIn()
  const busy = create.isPending || signIn.isPending

  const finish = (outcome: AuthOutcome, done: string) => {
    if (outcome.ok === true) {
      toast.success(done)
      setMessage(null)
    } else setMessage(outcome.ok === 'confirm' ? s.confirm : s.problems[outcome.problem])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (mode === 'create') finish(await create.mutateAsync({ email, password }), s.created)
    else finish(await signIn.mutateAsync({ email, password }), s.signedIn)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="account-email">{s.email}</Label>
          <Input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-password">{s.password}</Label>
          <Input
            id="account-password"
            type="password"
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'create' && <p className="text-xs text-muted-foreground">{s.passwordHint}</p>}
        </div>
      </div>
      {mode === 'sign-in' && <p className="text-sm text-muted-foreground">{s.signInHint}</p>}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          {mode === 'create' ? <UserPlus /> : <LogIn />}
          {mode === 'create' ? s.create : s.signIn}
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setMode(mode === 'create' ? 'sign-in' : 'create')
            setMessage(null)
          }}
        >
          {mode === 'create' ? s.haveAccount : s.needAccount}
        </Button>
      </div>
    </form>
  )
}

export function AccountCard() {
  const s = strings.use()
  const account = useAccount()
  const signOut = useSignOut()
  const member = account && !account.guest && account.email

  return (
    <Card id="account" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>{s.account}</CardTitle>
        <CardDescription>{member ? s.accountHint(member) : s.guestHint}</CardDescription>
      </CardHeader>
      <CardContent>
        {member ? (
          <Button
            variant="outline"
            disabled={signOut.isPending}
            onClick={async () => {
              if (!confirm(s.signOutConfirm)) return
              try {
                await signOut.mutateAsync()
                toast.success(s.signedOut)
              } catch (e) {
                toast.error(s.problems[authProblem(e)])
              }
            }}
          >
            <LogOut /> {s.signOut}
          </Button>
        ) : (
          <AccountForm />
        )}
      </CardContent>
    </Card>
  )
}
