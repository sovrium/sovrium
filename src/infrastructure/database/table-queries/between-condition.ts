/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'

/**
 * `between`, which keeps the values from the first to the second of a two-item
 * value, both ends included — in its two compiled forms: the SQL text of a
 * view or lookup filter, and the bound fragment of a records-API query.
 */

/**
 * The two ends of a `between` value, or `undefined` when it is not a two-item
 * list. The records API refuses any other shape with a 400 before a query is
 * built; a view or lookup filter is validated at boot.
 */
const betweenBoundsOf = (value: unknown): readonly [unknown, unknown] | undefined =>
  Array.isArray(value) && value.length === 2 ? [value[0], value[1]] : undefined

/**
 * The SQL text of a `between` condition on `field`, each bound formatted by
 * `format`; `undefined` for any other operator or a malformed value.
 */
export const betweenSqlCondition = (
  field: string,
  operator: string,
  value: unknown,
  format: (bound: unknown) => string
): string | undefined => {
  const bounds = operator === 'between' ? betweenBoundsOf(value) : undefined
  if (bounds === undefined) return undefined
  return `${field} BETWEEN ${format(bounds[0])} AND ${format(bounds[1])}`
}

/**
 * The fragment of a `between` condition on `column`, each bound a bound
 * parameter; `undefined` for any other operator or a malformed value.
 */
export const betweenFragment = (
  column: Readonly<ReturnType<typeof sql.identifier>>,
  operator: string,
  value: unknown
): Readonly<SQL> | undefined => {
  const bounds = operator === 'between' ? betweenBoundsOf(value) : undefined
  if (bounds === undefined) return undefined
  return sql`${column} BETWEEN ${bounds[0]} AND ${bounds[1]}`
}
