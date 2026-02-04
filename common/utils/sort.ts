type SortOrder = 'asc' | 'desc'
type NullsOrder = 'first' | 'last'

export interface SortOptions {
  order?: SortOrder // default: "asc"
  nulls?: NullsOrder // default: "last"
  locale?: string // default: "de" (wenn verfügbar)
  numericString?: boolean // default: true  ("10" > "2" korrekt)
  caseInsensitive?: boolean // default: true
}

/**
 * Liest einen verschachtelten Wert per Dot-Notation.
 * Unterstützt auch Array-Indizes im Pfad: "items.0.price"
 */
export function getByPath<T extends object>(obj: T, path: string): unknown {
  if (!path) return obj
  const parts = path.split('.')
  // biome-ignore lint/suspicious/noExplicitAny: used for dynamic access
  let cur: any = obj
  for (const p of parts) {
    if (cur == null) return undefined
    // Array-Index (z.B. "0") oder Property
    const key: string | number = /^\d+$/.test(p) ? Number(p) : p
    cur = cur[key]
  }
  return cur
}

function isDateLike(v: unknown): v is Date {
  return v instanceof Date && !Number.isNaN(v.getTime())
}

function isNullish(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))
}

function toComparable(v: unknown): { kind: 'nullish' | 'number' | 'string' | 'boolean' | 'date' | 'other'; value: unknown } {
  if (isNullish(v)) return { kind: 'nullish', value: null }
  if (isDateLike(v)) return { kind: 'date', value: v.getTime() }
  if (typeof v === 'number') return { kind: 'number', value: v }
  if (typeof v === 'boolean') return { kind: 'boolean', value: v ? 1 : 0 }
  if (typeof v === 'string') return { kind: 'string', value: v }
  return { kind: 'other', value: v }
}

function compareValues(a: unknown, b: unknown, opts: Required<SortOptions>): number {
  const A = toComparable(a)
  const B = toComparable(b)

  // null/undefined Handling
  if (A.kind === 'nullish' || B.kind === 'nullish') {
    if (A.kind === 'nullish' && B.kind === 'nullish') return 0
    const nullFirst = opts.nulls === 'first'
    return A.kind === 'nullish' ? (nullFirst ? -1 : 1) : nullFirst ? 1 : -1
  }

  // Beide Zahlen / Dates / Booleans -> numerisch
  const numericKinds = new Set(['number', 'date', 'boolean'])
  if (numericKinds.has(A.kind) && numericKinds.has(B.kind)) {
    const diff = (A.value as number) - (B.value as number)
    return diff === 0 ? 0 : diff < 0 ? -1 : 1
  }

  // Strings (mit Locale + numeric compare)
  if (A.kind === 'string' || B.kind === 'string') {
    const aStr = String(A.value)
    const bStr = String(B.value)
    const aNorm = opts.caseInsensitive ? aStr.toLocaleLowerCase(opts.locale) : aStr
    const bNorm = opts.caseInsensitive ? bStr.toLocaleLowerCase(opts.locale) : bStr

    return aNorm.localeCompare(bNorm, opts.locale, { numeric: opts.numericString, sensitivity: opts.caseInsensitive ? 'base' : 'variant' })
  }

  // Fallback: JSON/stringify Vergleich (deterministisch genug für viele Fälle)
  const aFallback = typeof A.value === 'object' ? JSON.stringify(A.value) : String(A.value)
  const bFallback = typeof B.value === 'object' ? JSON.stringify(B.value) : String(B.value)
  return aFallback.localeCompare(bFallback, opts.locale)
}

/**
 * Sortiert ein Array nach einem (verschachtelten) Key via Dot-Notation.
 * Gibt ein neues Array zurück (non-mutating).
 */
export function sortByPath<T extends object>(arr: readonly T[], path: string, options: SortOptions = {}): T[] {
  const opts: Required<SortOptions> = {
    order: options.order ?? 'asc',
    nulls: options.nulls ?? 'last',
    locale: options.locale ?? 'de',
    numericString: options.numericString ?? true,
    caseInsensitive: options.caseInsensitive ?? true
  }

  const dir = opts.order === 'asc' ? 1 : -1

  // Stabiler Sort: decorate -> sort -> undecorate
  return arr
    .map((item, idx) => ({ item, idx, key: getByPath(item, path) }))
    .sort((a, b) => {
      const cmp = compareValues(a.key, b.key, opts)
      if (cmp !== 0) {
        // Null-Reihenfolge soll unabhängig von asc/desc bleiben.
        if (isNullish(a.key) || isNullish(b.key)) return cmp
        return cmp * dir
      }
      return a.idx - b.idx // Stabilität bei Gleichstand
    })
    .map((x) => x.item)
}
