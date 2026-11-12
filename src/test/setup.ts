import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { notifyManager } from '@tanstack/react-query'
import { afterEach, beforeEach, vi } from 'vitest'
import { queryClient } from '@/data/query-client'
import { NO_SAVES, useServerSaves } from '@/data/server-saves'
import { seedProgress } from './progress'

vi.mock('@/data/progress-api', () => ({
  currentUserId: vi.fn(async () => 'test-user'),
  fetchProgress: vi.fn(async () => (await import('@/store/progress')).getProgress()),
  fetchReviews: vi.fn(async () => []),
  saveProgress: vi.fn(async () => {}),
  saveMedals: vi.fn(async () => {}),
  saveReport: vi.fn(async () => {}),
  resetLanguage: vi.fn(async () => {}),
  fetchSettings: vi.fn(async () => null),
  saveSettings: vi.fn(async () => {}),
}))

vi.mock('@/data/session', () => {
  const guest = { id: 'test-user', email: null, guest: true }
  return {
    currentAccount: vi.fn(async () => guest),
    ensureAccount: vi.fn(async () => guest),
    createAccount: vi.fn(async () => ({ ok: true })),
    signIn: vi.fn(async () => ({ ok: true })),
    signOut: vi.fn(async () => {}),
  }
})

notifyManager.setScheduler((run) => run())

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

beforeEach(() => {
  queryClient.clear()
  seedProgress()
  useServerSaves.setState({ ...NO_SAVES })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
