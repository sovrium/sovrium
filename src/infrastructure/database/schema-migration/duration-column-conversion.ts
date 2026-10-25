/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * Whether reshaping this column is the move of a `duration` field from the
 * `INTERVAL` an earlier version stored on PostgreSQL to the whole number of
 * seconds it stores now.
 */
export const isIntervalDurationConversion = (
  field: Fields[number],
  normalizedExisting: string,
  normalizedTarget: string
): boolean =>
  field.type === 'duration' && normalizedExisting === 'interval' && normalizedTarget === 'integer'

/**
 * The subcommands turning a legacy `INTERVAL` duration column into seconds.
 *
 * PostgreSQL has no cast from `interval` to `integer`, so the value goes
 * through its epoch: `INTERVAL '1 hour 30 minutes'` becomes 5400, rounded to
 * the whole second. The column default (`INTERVAL '600 seconds'`) cannot be
 * converted by that expression, so it is dropped before the type changes and
 * set again, as a number, after — the sequence PostgreSQL documents for a
 * column whose default would not survive the cast.
 */
export const intervalDurationSubcommands = (field: Fields[number], columnName: string): string => {
  const defaultValue = 'default' in field ? field.default : undefined
  const restoreDefault =
    typeof defaultValue === 'number' && Number.isFinite(defaultValue)
      ? `, ALTER COLUMN ${columnName} SET DEFAULT ${Math.round(defaultValue)}`
      : ''
  return (
    `ALTER COLUMN ${columnName} DROP DEFAULT, ` +
    `ALTER COLUMN ${columnName} TYPE INTEGER USING ROUND(EXTRACT(EPOCH FROM ${columnName}))::INTEGER` +
    restoreDefault
  )
}

/**
 * The `duration` columns still stored as the `INTERVAL` an earlier version
 * created on PostgreSQL, where the whole number of seconds (`integer`) is
 * expected. The full migration converts each in place
 * ({@link intervalDurationSubcommands}). Empty on SQLite, whose catalog map is
 * empty and whose column was always an integer.
 *
 * @param liveTypes - column name → the `data_type` the catalog reports
 */
export const findIntervalDurationColumns = (
  fields: readonly Fields[number][],
  liveTypes: ReadonlyMap<string, string>
): readonly string[] =>
  fields
    .filter(
      (field) =>
        field.type === 'duration' && liveTypes.get(field.name)?.toLowerCase().trim() === 'interval'
    )
    .map((field) => field.name)
