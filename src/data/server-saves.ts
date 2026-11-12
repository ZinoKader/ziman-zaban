import type { QueryClient } from '@tanstack/react-query'
import { create } from 'zustand'

export interface ServerSaves {
  pending: number
  waiting: boolean
  failed: boolean
  saves: number
  lastSavedAt: string | null
}

export const NO_SAVES: ServerSaves = { pending: 0, waiting: false, failed: false, saves: 0, lastSavedAt: null }

export const useServerSaves = create<ServerSaves>()(() => ({ ...NO_SAVES }))

export function trackServerSaves(client: QueryClient, key: readonly unknown[], store = useServerSaves, now = () => new Date()) {
  const ours = { mutationKey: key }
  return client.getMutationCache().subscribe((event) => {
    if (event.type !== 'updated' || !event.mutation) return
    const mutations = client.getMutationCache().findAll(ours)
    if (!mutations.includes(event.mutation)) return
    const active = mutations.filter((m) => m.state.status === 'pending')
    const { type } = event.action
    store.setState((s) => ({
      pending: active.length,
      waiting: active.some((m) => m.state.isPaused),
      failed: type === 'error' ? true : type === 'success' ? false : s.failed,
      saves: s.saves + (type === 'success' ? 1 : 0),
      lastSavedAt: type === 'success' ? now().toISOString() : s.lastSavedAt,
    }))
  })
}
