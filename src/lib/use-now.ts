import { useSyncExternalStore } from 'react'

const MINUTE = 60_000
const POLL_MS = 15_000

let current = { minute: -1, date: new Date(0) }

/** The same Date for everyone until the minute changes, so derived values stay memoizable. */
function snapshot(): Date {
  const minute = Math.floor(Date.now() / MINUTE)
  if (minute !== current.minute) current = { minute, date: new Date() }
  return current.date
}

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, POLL_MS)
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange()
  }
  window.addEventListener('focus', onChange)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearInterval(timer)
    window.removeEventListener('focus', onChange)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

/**
 * The current time, refreshed every minute and when the tab comes back into view,
 * for anything derived from the clock: what is due, today's count, "in 5 minutes".
 * A time captured once at mount goes stale on a page left open.
 */
export function useNow(): Date {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
