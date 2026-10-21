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
 * `date` as a `Date`.
 */

/** Whether a stored cell holds the value a seed row would write. */
export const sameStored = (stored: unknown, value: unknown): boolean => {
  if (value === null || value === undefined) return stored === null || stored === undefined
  if (stored instanceof Date) return stored.toISOString().startsWith(String(value))
  if (typeof value === 'boolean') return stored === value || Number(stored) === Number(value)
  if (typeof value === 'number') return Number(stored) === value
  if (typeof value === 'object') {
    const parsed = typeof stored === 'string' ? (JSON.parse(stored) as unknown) : stored
    return JSON.stringify(parsed) === JSON.stringify(value)
  }
  return String(stored) === String(value)
}

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
  const row = held.find((one) =>
    mergeOn.every((column) => String(one[column]) === String(fields[column]))
  )
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
