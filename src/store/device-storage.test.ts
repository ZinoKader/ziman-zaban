import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  checkPersistence,
  createDeviceStorage,
  memoryStorage,
  META_KEY,
  requestPersistence,
  type KVBackend,
} from './device-storage'
import { createSaveStatusStore } from './save-status'

function fakeBackend(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const calls = { setMany: 0 }
  const fail = { get: false, set: false, hang: false }
  const backend: KVBackend = {
    get: (k) => (fail.hang ? new Promise(() => {}) : fail.get ? Promise.reject(new Error('get')) : Promise.resolve(data.get(k))),
    setMany: async (entries) => {
      calls.setMany++
      if (fail.set) throw new Error('quota')
      for (const [k, v] of entries) data.set(k, v)
    },
    del: async (k) => void data.delete(k),
  }
  return { backend, data, calls, fail }
}

const fixedNow = () => new Date('2026-03-02T10:00:00.000Z')
const payload = (cards: Record<string, number>) => JSON.stringify({ state: { cards }, version: 1 })

function setup(initial: Record<string, string> = {}, legacyInit: Record<string, string> = {}) {
  const fake = fakeBackend(initial)
  const legacy = memoryStorage()
  for (const [k, v] of Object.entries(legacyInit)) legacy.setItem(k, v)
  const status = createSaveStatusStore()
  const storage = createDeviceStorage({ backend: fake.backend, legacy, status, now: fixedNow, timeoutMs: 20 })
  return { ...fake, legacy, status, storage }
}

describe('createDeviceStorage: migration from localStorage', () => {
  it('copies an old localStorage value into the database, then removes it', async () => {
    const old = payload({ water: 1 })
    const { storage, data, legacy, status } = setup({}, { 'zz-progress': old })
    expect(await storage.getItem('zz-progress')).toBe(old)
    expect(data.get('zz-progress')).toBe(old)
    expect(legacy.getItem('zz-progress')).toBeNull()
    expect(status.getState()).toMatchObject({ medium: 'indexeddb', lastSavedAt: fixedNow().toISOString() })
  })

  it('keeps the localStorage copy when writing to the database fails', async () => {
    const old = payload({ water: 1 })
    const { storage, legacy, fail, status } = setup({}, { 'zz-progress': old })
    fail.set = true
    expect(await storage.getItem('zz-progress')).toBe(old)
    expect(legacy.getItem('zz-progress')).toBe(old)
    expect(status.getState().medium).toBe('localstorage')
  })

  it('prefers the database and clears a stale localStorage copy', async () => {
    const fresh = payload({ water: 2 })
    const { storage, legacy } = setup({ 'zz-progress': fresh }, { 'zz-progress': payload({ water: 1 }) })
    expect(await storage.getItem('zz-progress')).toBe(fresh)
    expect(legacy.getItem('zz-progress')).toBeNull()
  })

  it('takes localStorage when it was written after the database (an earlier fallback visit)', async () => {
    const newer = payload({ water: 3 })
    const { storage, data } = setup(
      { 'zz-progress': payload({ water: 2 }), 'zz-settings': '{"newer":false}', [META_KEY]: JSON.stringify({ lastSavedAt: '2026-03-01T00:00:00.000Z' }) },
      { 'zz-progress': newer, 'zz-settings': '{"newer":true}', [META_KEY]: JSON.stringify({ lastSavedAt: '2026-03-01T12:00:00.000Z' }) },
    )
    expect(await storage.getItem('zz-progress')).toBe(newer)
    expect(data.get('zz-progress')).toBe(newer)
    expect(await storage.getItem('zz-settings')).toBe('{"newer":true}')
  })

  it('returns null for a key that exists nowhere', async () => {
    const { storage } = setup()
    expect(await storage.getItem('zz-progress')).toBeNull()
  })
})

describe('createDeviceStorage: writes', () => {
  it('ignores writes for a key until it has been read, so defaults never overwrite stored data', async () => {
    const stored = payload({ water: 5 })
    const { storage, data, calls } = setup({ 'zz-progress': stored })
    await storage.setItem('zz-progress', payload({}))
    expect(calls.setMany).toBe(0)
    expect(data.get('zz-progress')).toBe(stored)
    await storage.getItem('zz-progress')
    await storage.setItem('zz-progress', payload({ water: 6 }))
    expect(data.get('zz-progress')).toBe(payload({ water: 6 }))
  })

  it('coalesces rapid writes and records the save time', async () => {
    const { storage, data, calls, status } = setup()
    await storage.getItem('zz-progress')
    storage.setItem('zz-progress', payload({ a: 1 }))
    storage.setItem('zz-progress', payload({ a: 2 }))
    await storage.setItem('zz-progress', payload({ a: 3 }))
    expect(calls.setMany).toBe(1)
    expect(data.get('zz-progress')).toBe(payload({ a: 3 }))
    expect(JSON.parse(data.get(META_KEY)!)).toEqual({ lastSavedAt: fixedNow().toISOString() })
    expect(status.getState()).toMatchObject({ saves: 1, lastSavedAt: fixedNow().toISOString(), failed: false })
  })

  it('remembers the last save time between visits', async () => {
    const at = '2026-02-28T08:00:00.000Z'
    const { storage, status } = setup({ [META_KEY]: JSON.stringify({ lastSavedAt: at }) })
    await storage.ready
    expect(status.getState().lastSavedAt).toBe(at)
  })

  it('falls back to localStorage when a database write fails', async () => {
    const { storage, legacy, fail, status } = setup()
    await storage.getItem('zz-settings')
    fail.set = true
    await storage.setItem('zz-settings', '{"x":1}')
    expect(legacy.getItem('zz-settings')).toBe('{"x":1}')
    expect(status.getState()).toMatchObject({ medium: 'localstorage', saves: 1 })
  })
})

describe('createDeviceStorage: unavailable database', () => {
  it('uses localStorage when opening the database fails', async () => {
    const { storage, legacy, status } = setupFailing('get')
    legacy.setItem('zz-progress', 'old')
    expect(await storage.getItem('zz-progress')).toBe('old')
    expect(status.getState().medium).toBe('localstorage')
  })

  it('treats a database that never answers as unavailable', async () => {
    const { storage, legacy, status } = setupFailing('hang')
    legacy.setItem('zz-progress', 'old')
    expect(await storage.getItem('zz-progress')).toBe('old')
    expect(status.getState().medium).toBe('localstorage')
  })

  it('is synchronous on localStorage when there is no IndexedDB at all', () => {
    const legacy = memoryStorage()
    const status = createSaveStatusStore()
    const storage = createDeviceStorage({ backend: null, legacy, status, now: fixedNow })
    storage.setItem('zz-progress', 'v')
    expect(legacy.getItem('zz-progress')).toBe('v')
    expect(storage.getItem('zz-progress')).toBe('v')
    expect(status.getState()).toMatchObject({ medium: 'localstorage', saves: 1, lastSavedAt: fixedNow().toISOString() })
  })

  it('keeps working in memory when no storage is available', () => {
    const status = createSaveStatusStore()
    const storage = createDeviceStorage({ backend: null, legacy: null, status })
    storage.setItem('k', 'v')
    expect(storage.getItem('k')).toBe('v')
    expect(status.getState().medium).toBe('memory')
  })

  function setupFailing(mode: 'get' | 'hang') {
    const fake = fakeBackend()
    fake.fail[mode] = true
    const legacy = memoryStorage()
    const status = createSaveStatusStore()
    const storage = createDeviceStorage({ backend: fake.backend, legacy, status, timeoutMs: 20 })
    return { ...fake, legacy, status, storage }
  }
})

describe('with zustand persist', () => {
  it('hydrates asynchronously and a write during hydration does not clobber stored state', async () => {
    const { storage, data, legacy } = setup({}, { 'zz-test': JSON.stringify({ state: { count: 7 }, version: 0 }) })
    const useStore = create<{ count: number; inc: () => void }>()(
      persist((set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }), {
        name: 'zz-test',
        storage: createJSONStorage(() => storage),
        partialize: ({ count }) => ({ count }),
      }),
    )
    expect(useStore.persist.hasHydrated()).toBe(false)
    useStore.getState().inc()
    await new Promise<void>((resolve) => useStore.persist.onFinishHydration(() => resolve()))
    expect(useStore.getState().count).toBe(7)
    expect(legacy.getItem('zz-test')).toBeNull()
    useStore.getState().inc()
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    expect(JSON.parse(data.get('zz-test')!).state.count).toBe(8)
  })
})

describe('persistent storage', () => {
  it('asks the browser only once, and again only when forced', async () => {
    const { storage, status } = setup()
    const api = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) }
    expect(await requestPersistence(storage, { status, api })).toBe(true)
    expect(await requestPersistence(storage, { status, api })).toBe(true)
    expect(api.persist).toHaveBeenCalledTimes(1)
    expect(storage.meta()).toMatchObject({ persistAsked: true, persistent: true })
    await requestPersistence(storage, { status, api, force: true })
    expect(api.persist).toHaveBeenCalledTimes(2)
    expect(status.getState()).toMatchObject({ persistent: true, persistSupported: true })
  })

  it('does not ask when already granted', async () => {
    const { storage, status } = setup()
    const api = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) }
    await requestPersistence(storage, { status, api })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it('reports unsupported browsers', async () => {
    const { storage, status } = setup()
    expect(await checkPersistence(storage, status, {})).toBeNull()
    expect(status.getState()).toMatchObject({ persistSupported: false, persistent: null })
    expect(await checkPersistence(storage, status, { persisted: async () => true, persist: async () => true })).toBe(true)
    expect(status.getState()).toMatchObject({ persistSupported: true, persistent: true })
  })
})
