/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Replaying a seed under `--mode upsert`: which rows a replay would leave
 * exactly as they are. A row already holding every value its seed record
 * writes is not rewritten, so re-running the same seed — `sovrium import
 * --write --apply` on the same snapshot included — changes no row, and the
 * run reports it as unchanged rather than updated.
 *
 * A stored cell is compared in the spelling each engine returns it in: SQLite
 * keeps a checkbox as `1`/`0` and a JSON cell as text, PostgreSQL returns a
 * `date` as a `Date`. A JSON value is compared by structure, whatever the
 * order of its keys: a translatable field's language map comes back from
 * PostgreSQL's `jsonb` in an order of its own.
 */

/** One spelling per JSON value, its object keys sorted at every depth. */
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Whether a stored cell holds the value a seed row would write. */
export const sameStored = (stored: unknown, value: unknown): boolean => {
  if (value === null || value === undefined) return stored === null || stored === undefined
  if (stored instanceof Date) return stored.toISOString().startsWith(String(value))
  if (typeof value === 'boolean') return stored === value || Number(stored) === Number(value)
  if (typeof value === 'number') return Number(stored) === value
  if (typeof value === 'object') {
    const parsed = typeof stored === 'string' ? (JSON.parse(stored) as unknown) : stored
    return canonicalJson(parsed) === canonicalJson(value)
  }
  return String(stored) === String(value)
}

/**
 * Whether a stored row is the one a seed row merges onto: every merge column
 * holds the seed's value. A translatable merge column holds a language map,
 * and matches only when every language does; a cell that does not parse
 * matches nothing.
 */
export const matchesMergeKey = (
  row: Readonly<Record<string, unknown>>,
  mergeOn: readonly string[],
  fields: Readonly<Record<string, unknown>>
): boolean =>
  mergeOn.every((column) => {
    const value = fields[column]
    if (value === null || typeof value !== 'object') return String(row[column]) === String(value)
    try {
      return sameStored(row[column], value)
    } catch {
      return false
    }
  })

/**
 * Whether the row a seed record merges onto already holds every value it
 * writes. Such a row is left alone — not rewritten — so a replay changes
 * nothing, and is reported as unchanged.
 *
 * `insertOnly` names the columns an update never rewrites (the creation
 * instant, an autonumber): they are not compared, since a replay leaves them
 * as they are whatever the seed says.
 */
export const isUnchangedSeedRow = (
  held: readonly Readonly<Record<string, unknown>>[],
  mergeOn: readonly string[],
  fields: Readonly<Record<string, unknown>>,
  insertOnly: readonly string[] = []
): boolean => {
  const row = held.find((one) => matchesMergeKey(one, mergeOn, fields))
  if (row === undefined || (row['deleted_at'] !== null && row['deleted_at'] !== undefined))
    return false
  try {
    return Object.entries(fields)
      .filter(([name]) => !insertOnly.includes(name))
      .every(([name, value]) => sameStored(row[name], value))
  } catch {
    // A stored JSON cell that does not parse differs from what the seed writes.
    return false
  }
}
