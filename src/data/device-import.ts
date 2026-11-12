import type { TargetLang } from '@/content/types'
import { deviceStorage, safeLocalStorage } from '@/store/device-storage'
import { isEmpty, readProgress } from './backup'
import { saveProgress } from './progress-api'
import { progressRows, type FullProgress } from './rows'

export const DEVICE_PROGRESS_KEY = 'zz-progress'
export const IMPORTED_KEY = 'zz-progress-imported'

export function parseDeviceProgress(raw: string | null): FullProgress | null {
  if (!raw) return null
  try {
    return readProgress((JSON.parse(raw) as { state?: unknown }).state)
  } catch {
    return null
  }
}

export async function importDeviceProgress(userId: string, fallback: TargetLang, local = safeLocalStorage()): Promise<boolean> {
  if (local?.getItem(IMPORTED_KEY)) return false
  const saved = parseDeviceProgress(await deviceStorage.getItem(DEVICE_PROGRESS_KEY))
  const found = !!saved && !isEmpty(saved)
  if (found) await saveProgress(progressRows(saved, fallback))
  local?.setItem(IMPORTED_KEY, JSON.stringify({ userId, at: new Date().toISOString() }))
  return found
}
