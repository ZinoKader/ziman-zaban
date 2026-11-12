import { createStore, del, get, setMany } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'
import { useSaveStatus, type SaveStatusStore } from './save-status'

export const DB_NAME = 'ziman-zaban'
export const DB_STORE = 'kv'
export const META_KEY = 'zz-meta'

/** The minimal async key-value API we need; idb-keyval in the browser, a Map in tests. */
export interface KVBackend {
  get(key: string): Promise<string | undefined>
  setMany(entries: [string, string][]): Promise<void>
  del(key: string): Promise<void>
}

export interface StorageMeta {
  lastSavedAt?: string
  /** `navigator.storage.persist()` is only ever requested once. */
  persistAsked?: boolean
  persistent?: boolean
}

export interface DeviceStorage extends StateStorage {
  /** Resolves once the backend is open and the metadata is read (or we fell back). */
  ready: Promise<void>
  meta: () => StorageMeta
  updateMeta: (patch: StorageMeta) => Promise<void>
  /** The stored value, without the first-read migration `getItem` does. */
  read: (name: string) => Promise<string | null>
  /** Calls `listener` with the keys of every write that reached the device. */
  onSaved: (listener: (names: string[]) => void) => () => void
  /** A write of `name` is queued or in flight. */
  isWriting: (name: string) => boolean
  /** Runs `fn` with writes ignored: for applying state that was just read from the device. */
  quietly: (fn: () => void) => void
}

/** Shared by the database storage and its localStorage fallback. */
interface Hooks {
  saved: Set<(names: string[]) => void>
  muted: number
}

function newHooks(): Hooks {
  return { saved: new Set(), muted: 0 }
}

function hookApi(hooks: Hooks) {
  return {
    onSaved: (listener: (names: string[]) => void) => {
      hooks.saved.add(listener)
      return () => void hooks.saved.delete(listener)
    },
    quietly: (fn: () => void) => {
      hooks.muted++
      try {
        fn()
      } finally {
        hooks.muted--
      }
    },
  }
}

const emitSaved = (hooks: Hooks, names: string[]) => hooks.saved.forEach((l) => l(names))

export interface DeviceStorageOptions {
  backend: KVBackend | null
  /** Old home of the data (localStorage); migrated from, and used when the backend is unavailable. */
  legacy: Storage | null
  status?: SaveStatusStore
  /** A backend that does not answer in time (some private modes hang) is treated as unavailable. */
  timeoutMs?: number
  now?: () => Date
}

export function idbBackend(): KVBackend | null {
  if (typeof indexedDB === 'undefined') return null
  try {
    const store = createStore(DB_NAME, DB_STORE)
    return {
      get: (key) => get<string>(key, store),
      setMany: (entries) => setMany(entries, store),
      del: (key) => del(key, store),
    }
  } catch {
    return null
  }
}

export function safeLocalStorage(): Storage | null {
  try {
    const ls = globalThis.localStorage
    if (!ls) return null
    const probe = '__zz_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return ls
  } catch {
    return null
  }
}

export function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('storage timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function parseMeta(raw: string | null | undefined): StorageMeta {
  if (!raw) return {}
  try {
    const m = JSON.parse(raw)
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}

function attempt<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}

/**
 * Synchronous storage over localStorage (or memory). Used when IndexedDB is missing,
 * and as the fallback when it fails. Being synchronous keeps hydration instant there.
 */
function syncStorage(store: Storage, status: SaveStatusStore, now: () => Date, hooks = newHooks()): DeviceStorage {
  let meta = parseMeta(attempt(() => store.getItem(META_KEY)))
  status.setState({ lastSavedAt: meta.lastSavedAt ?? null })
  const writeMeta = (next: StorageMeta) => {
    meta = next
    store.setItem(META_KEY, JSON.stringify(meta))
  }
  return {
    ready: Promise.resolve(),
    meta: () => meta,
    updateMeta: async (patch) => void attempt(() => writeMeta({ ...meta, ...patch })),
    ...hookApi(hooks),
    read: async (name) => attempt(() => store.getItem(name)),
    isWriting: () => false,
    getItem: (name) => attempt(() => store.getItem(name)),
    setItem: (name, value) => {
      if (hooks.muted) return
      try {
        store.setItem(name, value)
        const at = now().toISOString()
        attempt(() => writeMeta({ ...meta, lastSavedAt: at }))
        status.setState((s) => ({ lastSavedAt: at, saves: s.saves + 1, failed: false }))
        emitSaved(hooks, [name])
      } catch {
        status.setState({ failed: true })
      }
    },
    removeItem: (name) => void attempt(() => store.removeItem(name)),
  }
}

/**
 * A zustand `StateStorage` that keeps data in IndexedDB.
 *
 * - On first read of a key that IndexedDB does not have yet, the old localStorage
 *   value is copied over and removed only after the write succeeded.
 * - Writes for a key are ignored until that key has been read once, so defaults set
 *   during async hydration can never overwrite stored progress.
 * - Rapid writes are coalesced; each batch also stores the save time.
 * - Any backend failure switches the rest of the visit to localStorage.
 */
export function createDeviceStorage({
  backend,
  legacy,
  status = useSaveStatus,
  timeoutMs = 4000,
  now = () => new Date(),
}: DeviceStorageOptions): DeviceStorage {
  const fallbackStore = () => legacy ?? memoryStorage()
  const fallbackMedium = legacy ? 'localstorage' : 'memory'
  const hooks = newHooks()
  if (!backend) {
    status.setState({ medium: fallbackMedium })
    return syncStorage(fallbackStore(), status, now, hooks)
  }

  let fallback: DeviceStorage | null = null
  const toFallback = (): DeviceStorage => {
    if (!fallback) {
      fallback = syncStorage(fallbackStore(), status, now, hooks)
      status.setState({ medium: fallbackMedium })
    }
    return fallback
  }

  let meta: StorageMeta = {}
  /** localStorage wins only when it holds data written after IndexedDB's (an earlier fallback visit). */
  let legacyIsNewer = false
  const legacyMeta = parseMeta(attempt(() => legacy?.getItem(META_KEY)))
  const ready = withTimeout(backend.get(META_KEY), timeoutMs).then(
    (raw) => {
      meta = parseMeta(raw)
      legacyIsNewer = !!legacyMeta.lastSavedAt && (!meta.lastSavedAt || legacyMeta.lastSavedAt > meta.lastSavedAt)
      status.setState({ medium: 'indexeddb', lastSavedAt: meta.lastSavedAt ?? legacyMeta.lastSavedAt ?? null })
    },
    () => void toFallback(),
  )

  const loaded = new Set<string>()
  const pending = new Map<string, string>()
  const inFlight = new Set<string>()
  let flushing: Promise<void> | null = null

  const getItem = async (name: string): Promise<string | null> => {
    await ready
    try {
      if (fallback) return fallback.getItem(name) as string | null
      const stored = await withTimeout(backend.get(name), timeoutMs)
      const old = attempt(() => legacy?.getItem(name) ?? null)
      if (old != null && (stored == null || legacyIsNewer)) {
        const at = now().toISOString()
        const next = { ...meta, lastSavedAt: meta.lastSavedAt && meta.lastSavedAt > at ? meta.lastSavedAt : at }
        await backend.setMany([[name, old], [META_KEY, JSON.stringify(next)]])
        meta = next
        status.setState({ lastSavedAt: next.lastSavedAt })
        attempt(() => legacy?.removeItem(name))
        return old
      }
      if (old != null) attempt(() => legacy?.removeItem(name))
      return stored ?? null
    } catch {
      return toFallback().getItem(name) as string | null
    } finally {
      loaded.add(name)
    }
  }

  const flush = async () => {
    await Promise.resolve()
    while (pending.size) {
      const entries = [...pending.entries()]
      pending.clear()
      if (fallback) {
        for (const [k, v] of entries) fallback.setItem(k, v)
        continue
      }
      const at = now().toISOString()
      const next = { ...meta, lastSavedAt: at }
      const names = entries.map(([k]) => k)
      names.forEach((k) => inFlight.add(k))
      try {
        await backend.setMany([...entries, [META_KEY, JSON.stringify(next)]])
        meta = next
        status.setState((s) => ({ lastSavedAt: at, saves: s.saves + 1, failed: false }))
        emitSaved(hooks, names)
      } catch {
        const f = toFallback()
        for (const [k, v] of entries) f.setItem(k, v)
      } finally {
        names.forEach((k) => inFlight.delete(k))
      }
    }
    flushing = null
  }

  return {
    ready,
    meta: () => (fallback ? fallback.meta() : meta),
    updateMeta: async (patch) => {
      await ready
      if (fallback) return fallback.updateMeta(patch)
      meta = { ...meta, ...patch }
      await backend.setMany([[META_KEY, JSON.stringify(meta)]]).catch(() => toFallback().updateMeta(patch))
    },
    ...hookApi(hooks),
    read: async (name) => {
      await ready
      if (fallback) return fallback.read(name)
      return withTimeout(backend.get(name), timeoutMs).then(
        (v) => v ?? null,
        () => null,
      )
    },
    isWriting: (name) => pending.has(name) || inFlight.has(name),
    getItem,
    setItem: (name, value) => {
      if (!loaded.has(name) || hooks.muted) return
      pending.set(name, value)
      flushing ??= flush()
      return flushing
    },
    removeItem: async (name) => {
      pending.delete(name)
      attempt(() => legacy?.removeItem(name))
      if (fallback) return fallback.removeItem(name)
      await backend.del(name).catch(() => undefined)
    },
  }
}

export interface PersistenceApi {
  persisted?: () => Promise<boolean>
  persist?: () => Promise<boolean>
}

const storageManager = (): PersistenceApi | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator.storage as PersistenceApi | undefined)

/** Reads whether the browser already granted persistent storage, without asking. */
export async function checkPersistence(storage: DeviceStorage, status: SaveStatusStore = useSaveStatus, api = storageManager()) {
  if (!api?.persisted || !api.persist) {
    status.setState({ persistSupported: false, persistent: null })
    return null
  }
  const granted = await api.persisted().catch(() => storage.meta().persistent ?? false)
  status.setState({ persistSupported: true, persistent: granted })
  return granted
}

/**
 * Asks the browser to keep our data even under storage pressure.
 * Without `force` this happens at most once ever (Firefox shows a prompt).
 */
export async function requestPersistence(
  storage: DeviceStorage,
  { force = false, status = useSaveStatus, api = storageManager() }: { force?: boolean; status?: SaveStatusStore; api?: PersistenceApi } = {},
) {
  if (!api?.persist || !api.persisted) return null
  await storage.ready
  if (!force && storage.meta().persistAsked) return status.getState().persistent
  const already = await api.persisted().catch(() => false)
  const granted = already || (await api.persist().catch(() => false))
  await storage.updateMeta({ persistAsked: true, persistent: granted })
  status.setState({ persistSupported: true, persistent: granted })
  return granted
}

export const deviceStorage: DeviceStorage = createDeviceStorage({ backend: idbBackend(), legacy: safeLocalStorage() })
