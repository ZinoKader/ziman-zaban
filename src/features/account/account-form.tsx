import { LogIn, LogOut, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authProblem } from '@/data/auth-problem'
import type { AuthOutcome } from '@/data/session'
import { cn } from '@/lib/utils'
import { useCreateAccount, useSignIn, useSignOut } from '@/store/account'
import { accountStrings as strings } from './strings'

export type AccountMode = 'create' | 'sign-in'

interface AccountFormProps {
  id: string
  initialMode?: AccountMode
  compact?: boolean
  autoFocus?: boolean
  onDone?: () => void
}

export function AccountForm({ id, initialMode = 'create', compact = false, autoFocus = false, onDone }: AccountFormProps) {
  const s = strings.use()
  const [mode, setMode] = useState<AccountMode>(initialMode)
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
      onDone?.()
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
      <div className={cn('grid gap-3', !compact && 'sm:grid-cols-2')}>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-email`}>{s.email}</Label>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            autoFocus={autoFocus}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-password`}>{s.password}</Label>
          <Input
            id={`${id}-password`}
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
      <div className={cn('flex flex-wrap items-center gap-2', compact && 'flex-col items-stretch')}>
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

export function SignOutButton({ onDone, className }: { onDone?: () => void; className?: string }) {
  const s = strings.use()
  const signOut = useSignOut()
  return (
    <Button
      variant="outline"
      className={className}
      disabled={signOut.isPending}
      onClick={async () => {
        if (!confirm(s.signOutConfirm)) return
        try {
          await signOut.mutateAsync()
          toast.success(s.signedOut)
          onDone?.()
        } catch (e) {
          toast.error(s.problems[authProblem(e)])
        }
      }}
    >
      <LogOut /> {s.signOut}
    </Button>
  )
}
