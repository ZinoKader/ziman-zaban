import type { BaseLang } from '@/content/types'

type Dict = { en: Record<string, unknown>; sv: Record<string, unknown> }

const recorded = vi.hoisted(() => [] as Dict[])

vi.mock('@/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n')>()
  return {
    ...actual,
    defineStrings: ((dict: Dict) => {
      recorded.push(dict)
      return actual.defineStrings(dict)
    }) as typeof actual.defineStrings,
  }
})

/** Structure of a strings value: keys, array lengths, function arity; leaves are just "string". */
function shape(value: unknown): unknown {
  if (typeof value === 'function') return `function/${value.length}`
  if (Array.isArray(value)) return value.map(shape)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, shape((value as Record<string, unknown>)[k])]),
    )
  }
  return typeof value
}

function emptyStrings(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return value.trim() ? [] : [path]
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => emptyStrings(v, `${path}.${k}`))
  }
  return []
}

interface StringsModule {
  get(lang: BaseLang): Record<string, unknown>
  use(): unknown
}
const isStrings = (v: unknown): v is StringsModule =>
  !!v && typeof v === 'object' && typeof (v as StringsModule).get === 'function' && typeof (v as StringsModule).use === 'function'

function exportedStrings(modules: Record<string, Record<string, unknown>>) {
  return Object.entries(modules).flatMap(([path, mod]) =>
    Object.entries(mod)
      .filter(([, v]) => isStrings(v))
      .map(([name, v]) => ({ where: `${path} ${name}`, strings: v as StringsModule })),
  )
}

describe('exported strings (common.ts and features/**/strings.ts)', async () => {
  const common = await import('@/i18n/common')
  const features = import.meta.glob<Record<string, unknown>>('/src/features/**/strings.ts', { eager: true })
  const all = exportedStrings({ 'src/i18n/common.ts': common, ...features })

  it('finds the string tables', () => {
    expect(all.some((s) => s.where.startsWith('src/i18n/common.ts'))).toBe(true)
    expect(all.length).toBeGreaterThanOrEqual(Object.keys(features).length)
  })

  it.each(all.map((s) => [s.where, s.strings] as const))('%s: en and sv have the same shape', (_, strings) => {
    expect(shape(strings.get('sv'))).toEqual(shape(strings.get('en')))
  })

  it.each(all.map((s) => [s.where, s.strings] as const))('%s: a string is empty in both languages or in neither', (_, strings) => {
    expect(emptyStrings(strings.get('sv'))).toEqual(emptyStrings(strings.get('en')))
  })
})

describe('every defineStrings call in src', async () => {
  const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/i18n/index.ts'], {
    eager: true,
    query: '?raw',
    import: 'default',
  })
  const loaders = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/i18n/index.ts'])
  const calls = Object.entries(sources)
    .map(([path, src]) => ({ path, count: src.match(/\bdefineStrings\(/g)?.length ?? 0 }))
    .filter((f) => f.count > 0)

  for (const { path } of calls) await loaders[path]()

  it('records one dictionary per call site', () => {
    expect(calls.length).toBeGreaterThan(1)
    expect(recorded.length).toBe(calls.reduce((n, f) => n + f.count, 0))
  })

  it('every dictionary has the same shape in en and sv', () => {
    const mismatches = recorded
      .filter((d) => JSON.stringify(shape(d.en)) !== JSON.stringify(shape(d.sv)))
      .map((d) => ({ keys: Object.keys(d.en).slice(0, 4), en: shape(d.en), sv: shape(d.sv) }))
    expect(mismatches).toEqual([])
  })
})

describe('shape', () => {
  it('notices missing keys, nesting and arity differences', () => {
    expect(shape({ a: 'x', b: { c: 'y' } })).not.toEqual(shape({ a: 'x', b: {} }))
    expect(shape({ due: (n: number) => `${n}` })).not.toEqual(shape({ due: (n: number, m: number) => `${n}${m}` }))
    expect(shape({ due: (n: number) => `${n}` })).not.toEqual(shape({ due: 'due' }))
    expect(shape({ b: 'x', a: 'y' })).toEqual(shape({ a: 'z', b: 'w' }))
  })
})
