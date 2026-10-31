import type { BaseLang, Localized } from '@/content/types'
import { useSettings } from '@/store/settings'

/**
 * UI strings are defined next to the feature that uses them:
 *
 *   const strings = defineStrings({
 *     en: { start: 'Start', due: (n: number) => `${n} due` },
 *     sv: { start: 'Starta', due: (n: number) => `${n} att repetera` },
 *   })
 *   const s = strings.use()
 *
 * TypeScript enforces that Swedish has exactly the same keys as English.
 */
export function defineStrings<T extends Record<string, unknown>>(dict: { en: T; sv: NoInfer<T> }) {
  return {
    use(): T {
      const lang = useSettings((s) => s.baseLang)
      return dict[lang]
    },
    get(lang: BaseLang): T {
      return dict[lang]
    },
  }
}

/** Picks the base-language text from a content `Localized` value. */
export function useLocalize() {
  const lang = useSettings((s) => s.baseLang)
  return (value: Localized | undefined) => (value ? value[lang] : '')
}

export function localize(value: Localized, lang: BaseLang): string {
  return value[lang]
}
