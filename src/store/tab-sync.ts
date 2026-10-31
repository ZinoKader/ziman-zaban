import { deviceStorage, type DeviceStorage } from './device-storage'
import { useProgress } from './progress'
import { useSettings } from './settings'

export const TAB_CHANNEL = 'ziman-zaban'

/** The part of a zustand persist store that syncing needs. */
export interface SyncedStore {
  setState: (state: object) => void
  persist: {
    getOptions: () => { name?: string; version?: number }
    hasHydrated: () => boolean
  }
}

export type TabChannel = Pick<BroadcastChannel, 'postMessage' | 'close'> & {
  onmessage: ((e: MessageEvent) => void) | null
}

interface SavedMessage {
  type: 'saved'
  names: string[]
}

const openChannel = (): TabChannel | null =>
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(TAB_CHANNEL)

/**
 * Keeps every open tab on the latest saved state. Without it a tab left open keeps
 * its old copy in memory, and the next answer given there writes that copy over
 * the progress made in another tab.
 *
 * After each save a tab names the saved keys on a BroadcastChannel; the others read
 * those keys back from the device and apply them without writing them again.
 * A tab with its own write of that key still pending keeps its state; its save
 * follows right after and the other tabs take that one instead.
 */
export function startTabSync({
  storage = deviceStorage,
  stores = [useProgress, useSettings] as SyncedStore[],
  channel = openChannel(),
}: { storage?: DeviceStorage; stores?: SyncedStore[]; channel?: TabChannel | null } = {}): () => void {
  if (!channel) return () => {}
  const byName = new Map(stores.map((s) => [s.persist.getOptions().name, s]))

  const pull = async (name: string) => {
    const store = byName.get(name)
    if (!store?.persist.hasHydrated() || storage.isWriting(name)) return
    const raw = await storage.read(name)
    if (!raw || storage.isWriting(name)) return
    try {
      const { state, version } = JSON.parse(raw) as { state?: object; version?: number }
      if (!state || version !== store.persist.getOptions().version) return
      storage.quietly(() => store.setState(state))
    } catch {
      // A value this version can't read is left for a reload.
    }
  }

  const offSaved = storage.onSaved((names) => {
    const synced = names.filter((n) => byName.has(n))
    if (synced.length) channel.postMessage({ type: 'saved', names: synced } satisfies SavedMessage)
  })
  channel.onmessage = (e) => {
    const msg = e.data as Partial<SavedMessage> | null
    if (msg?.type === 'saved' && Array.isArray(msg.names)) msg.names.forEach((n) => void pull(n))
  }
  return () => {
    offSaved()
    channel.onmessage = null
    channel.close()
  }
}
