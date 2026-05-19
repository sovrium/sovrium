/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { escapeSqlString } from '@/domain/utils/sql-formatting'

export { escapeSqlString, formatSqlValue, formatLikePattern } from '@/domain/utils/sql-formatting'

export const jsonbLiteral = (value: unknown) => {
  const literal = escapeSqlString(JSON.stringify(value))
  return sql.raw(`'${literal}'::jsonb`)
}

export const pgTextArrayLiteral = (values: ReadonlyArray<string | number | boolean>) => {
  if (values.length === 0) return sql.raw(`ARRAY[]::text[]`)
  const literal = values.map((v) => `'${escapeSqlString(String(v))}'`).join(', ')
  return sql.raw(`ARRAY[${literal}]::text[]`)
}

export const extractRows = (result: unknown): ReadonlyArray<Record<string, unknown>> => {
  if (Array.isArray(result)) return result as ReadonlyArray<Record<string, unknown>>
  if (typeof result === 'object' && result !== null && 'rows' in result) {
    const wrapped = (result as { readonly rows?: unknown }).rows
    if (Array.isArray(wrapped)) return wrapped as ReadonlyArray<Record<string, unknown>>
  }
  return []
}
