import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createDeviceStorage, memoryStorage, type KVBackend } from './device-storage'
import { createSaveStatusStore } from './save-status'
import { startTabSync, type TabChannel } from './tab-sync'

/** One browser profile: a database every tab shares, and a channel between tabs. */
function browser() {
  const data = new Map<string, string>()
  const writes: string[] = []
  const backend: KVBackend = {
    get: async (k) => data.get(k),
    setMany: async (entries) => {
      for (const [k, v] of entries) {
        data.set(k, v)
        writes.push(k)
      }
    },
    del: async (k) => void data.delete(k),
  }
  const channels = new Set<TabChannel>()
  const channel = (): TabChannel => {
    const c: TabChannel = {
      onmessage: null,
      postMessage: (data: unknown) => {
        for (const other of channels) {
          if (other !== c) queueMicrotask(() => other.onmessage?.(new MessageEvent('message', { data })))
        }
      },
      close: () => void channels.delete(c),
    }
    channels.add(c)
    return c
  }
  return { data, writes, backend, channel }
}

interface Counter {
  count: number
  inc: () => void
}

async function openTab(b: ReturnType<typeof browser>) {
  const storage = createDeviceStorage({ backend: b.backend, legacy: memoryStorage(), status: createSaveStatusStore() })
  const useStore = create<Counter>()(
    persist((set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }), {
      name: 'zz-progress',
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: ({ count }) => ({ count }),
    }),
  )
  if (!useStore.persist.hasHydrated()) await new Promise<void>((r) => useStore.persist.onFinishHydration(() => r()))
  const stop = startTabSync({ storage, stores: [useStore], channel: b.channel() })
  return { storage, useStore, stop }
}

const stored = (b: ReturnType<typeof browser>) => JSON.parse(b.data.get('zz-progress') ?? '{"state":{}}').state.count

describe('startTabSync', () => {
  it('keeps a second tab up to date, so it never writes its old copy over newer progress', async () => {
    const b = browser()
    const a = await openTab(b)
    const other = await openTab(b)

    a.useStore.getState().inc()
    a.useStore.getState().inc()
    a.useStore.getState().inc()
    await vi.waitFor(() => expect(other.useStore.getState().count).toBe(3))

    other.useStore.getState().inc()
    await vi.waitFor(() => expect(stored(b)).toBe(4))
    await vi.waitFor(() => expect(a.useStore.getState().count).toBe(4))
  })

  it('applies what another tab saved without saving it again', async () => {
    const b = browser()
    const a = await openTab(b)
    const other = await openTab(b)
    a.useStore.getState().inc()
    await vi.waitFor(() => expect(other.useStore.getState().count).toBe(1))
    await new Promise((r) => setTimeout(r, 10))
    expect(b.writes.filter((k) => k === 'zz-progress')).toHaveLength(1)
  })

  it('stops listening when stopped', async () => {
    const b = browser()
    const a = await openTab(b)
    const other = await openTab(b)
    other.stop()
    a.useStore.getState().inc()
    await vi.waitFor(() => expect(stored(b)).toBe(1))
    await new Promise((r) => setTimeout(r, 10))
    expect(other.useStore.getState().count).toBe(0)
  })

  it('does nothing without BroadcastChannel', () => {
    expect(startTabSync({ channel: null })).toBeTypeOf('function')
  })
})
