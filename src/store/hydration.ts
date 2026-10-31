import { useSyncExternalStore } from 'react'
import { checkPersistence, deviceStorage, requestPersistence } from './device-storage'
import { useProgress } from './progress'
import { useSaveStatus } from './save-status'
import { useSettings } from './settings'

const persisted = [useProgress, useSettings]

function subscribe(onChange: () => void) {
  const unsubs = persisted.map((s) => s.persist.onFinishHydration(onChange))
  return () => unsubs.forEach((u) => u())
}

export function allHydrated(): boolean {
  return persisted.every((s) => s.persist.hasHydrated())
}

/** True once progress and settings were read from the device; the UI waits for it. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, allHydrated, allHydrated)
}

let started = false

/** Reads the persistent-storage state now and asks for it once, after the first real save. */
export function startPersistence() {
  if (started) return
  started = true
  void deviceStorage.ready.then(() => checkPersistence(deviceStorage))
  const unsub = useSaveStatus.subscribe((s, prev) => {
    if (s.saves > 0 && prev.saves === 0) {
      unsub()
      void requestPersistence(deviceStorage)
    }
  })
}
