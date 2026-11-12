const QUIET_MS = 7 * 86_400_000

export function shouldPrompt(hiddenAt: string | null, now: number): boolean {
  return !hiddenAt || now - Date.parse(hiddenAt) >= QUIET_MS
}
