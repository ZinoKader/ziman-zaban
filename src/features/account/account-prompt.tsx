import { CloudUpload, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { memberEmail, useAccount } from '@/store/account'
import { useSettings } from '@/store/settings'
import { AccountForm } from './account-form'
import { shouldPrompt } from './prompt'
import { accountStrings as strings } from './strings'

export function AccountPrompt() {
  const s = strings.use()
  const account = useAccount()
  const hiddenAt = useSettings((st) => st.accountPromptHiddenAt)
  const set = useSettings((st) => st.set)
  const [open, setOpen] = useState(false)
  const [now] = useState(() => Date.now())

  if (!account || memberEmail(account) || !shouldPrompt(hiddenAt, now)) return null

  return (
    <Card className="w-full border-primary/30 bg-primary/5 py-4 text-start">
      <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center">
        <CloudUpload className="size-6 shrink-0 text-primary" />
        <div className="flex-1 space-y-0.5">
          <p className="font-medium">{s.promptTitle}</p>
          <p className="text-sm text-muted-foreground">{s.promptBody}</p>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <Button size="sm" onClick={() => setOpen(true)}>
            <UserPlus /> {s.create}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => set({ accountPromptHiddenAt: new Date().toISOString() })}>
            {s.later}
          </Button>
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{s.keepTitle}</DialogTitle>
            <DialogDescription>{s.keepHint}</DialogDescription>
          </DialogHeader>
          <AccountForm id="prompt-account" compact autoFocus onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
