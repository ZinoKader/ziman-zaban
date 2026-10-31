import { create, type StoreApi, type UseBoundStore } from 'zustand'

/** Where progress actually ended up: the browser database, the smaller key-value store, or nowhere durable. */
export type StorageMedium = 'indexeddb' | 'localstorage' | 'memory'

export interface SaveStatus {
  medium: StorageMedium
  /** Whether the browser promised not to evict our data. `null` when unknown or unsupported. */
  persistent: boolean | null
  persistSupported: boolean
  /** ISO time of the last successful write, carried over between visits. */
  lastSavedAt: string | null
  /** Successful writes in this visit; changes on every save. */
  saves: number
  /** The last write failed everywhere (quota, blocked storage). */
  failed: boolean
}

export type SaveStatusStore = UseBoundStore<StoreApi<SaveStatus>>

export const INITIAL_SAVE_STATUS: SaveStatus = {
  medium: 'indexeddb',
  persistent: null,
  persistSupported: false,
  lastSavedAt: null,
  saves: 0,
  failed: false,
}

export function createSaveStatusStore(): SaveStatusStore {
  return create<SaveStatus>()(() => ({ ...INITIAL_SAVE_STATUS }))
}

export const useSaveStatus = createSaveStatusStore()
