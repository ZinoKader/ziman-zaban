import { createStore, del, delMany, get, set, type UseStore } from 'idb-keyval'

/** WAV bytes per take, in IndexedDB; in memory where there is none (tests, some private modes). */
const memory = new Map<string, Uint8Array<ArrayBuffer>>()
let store: UseStore | null | undefined

function db(): UseStore | null {
  if (store === undefined) store = typeof indexedDB === 'undefined' ? null : createStore('zz-studio', 'takes')
  return store
}

export async function saveAudio(key: string, wav: Uint8Array<ArrayBuffer>): Promise<void> {
  const s = db()
  if (!s) return void memory.set(key, wav)
  try {
    await set(key, wav, s)
  } catch {
    memory.set(key, wav)
  }
}

export async function loadAudio(key: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const s = db()
  if (memory.has(key) || !s) return memory.get(key)
  return get<Uint8Array<ArrayBuffer>>(key, s).catch(() => undefined)
}

export async function deleteAudio(keys: string[]): Promise<void> {
  for (const k of keys) memory.delete(k)
  const s = db()
  if (!s || !keys.length) return
  await (keys.length === 1 ? del(keys[0], s) : delMany(keys, s)).catch(() => {})
}
