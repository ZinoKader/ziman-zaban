import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { queryClient } from '@/data/query-client'
import { createAccount, currentAccount, signIn, signOut, type Account, type AuthOutcome } from '@/data/session'
import { pullSettings } from '@/data/settings-sync'
import { reloadProgress } from './progress'
import { useSettings } from './settings'

export const ACCOUNT_KEY = ['account'] as const

export const accountQuery = queryOptions({ queryKey: ACCOUNT_KEY, queryFn: currentAccount, staleTime: Infinity })

export function useAccount() {
  return useQuery(accountQuery, queryClient).data ?? null
}

export function memberEmail(account: Account | null): string | null {
  return account && !account.guest && account.email ? account.email : null
}

const refreshAccount = () => queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY })

export function useCreateAccount() {
  return useMutation(
    {
      mutationFn: ({ email, password }: { email: string; password: string }) => createAccount(email, password),
      onSuccess: refreshAccount,
    },
    queryClient,
  )
}

export function useSignIn() {
  return useMutation(
    {
      mutationFn: async ({ email, password }: { email: string; password: string }): Promise<AuthOutcome> => {
        const outcome = await signIn(email, password, useSettings.getState().targetLang)
        if (outcome.ok !== true) return outcome
        await pullSettings({ preferServer: true }).catch(() => {})
        await Promise.all([refreshAccount(), reloadProgress()])
        return outcome
      },
    },
    queryClient,
  )
}

export function useSignOut() {
  return useMutation(
    {
      mutationFn: async () => {
        await signOut()
        await Promise.all([refreshAccount(), reloadProgress()])
      },
    },
    queryClient,
  )
}
