import { importDeviceProgress } from '@/data/device-import'
import { queryClient } from '@/data/query-client'
import { ensureAccount } from '@/data/session'
import { pullSettings, pushSettingsOnChange } from '@/data/settings-sync'
import { accountQuery } from '@/store/account'
import { progressQuery } from '@/store/progress'
import { useSettings } from '@/store/settings'

function settingsHydrated(): Promise<void> {
  if (useSettings.persist.hasHydrated()) return Promise.resolve()
  return new Promise((resolve) => {
    const off = useSettings.persist.onFinishHydration(() => {
      off()
      resolve()
    })
  })
}

let pushing = false

export async function boot(): Promise<true> {
  await settingsHydrated()
  const account = await ensureAccount()
  queryClient.setQueryData(accountQuery.queryKey, account)
  await importDeviceProgress(account.id, useSettings.getState().targetLang)
  await pullSettings().catch(() => {})
  if (!pushing) {
    pushing = true
    pushSettingsOnChange()
  }
  await queryClient.ensureQueryData(progressQuery)
  return true
}
