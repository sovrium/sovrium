/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

// Re-export from domain layer — pure string transformations for DDL generation
// only (standing rule S3); a runtime value binds through `bindJsonb` /
// `bindTextArray` or a plain `sql\`${value}\`` parameter.
export {
  escapeSqlString,
  formatSqlValue,
  formatLikePattern,
} from '@/domain/kernel/sql/sql-formatting'

/**
 * Bind a JS value as a JSON parameter, typed `jsonb` on PostgreSQL, on the
 * dialect the caller holds.
 *
 * The value is serialised with `JSON.stringify` and sent as ONE bound
 * parameter (standing rule S3: runtime values bind, they are never spliced
 * into SQL text). Never interpolate it into `sql.raw`.
 *
 * Why the double cast on PostgreSQL
 * ---------------------------------
 * `$1::jsonb` lets the server infer the parameter as `jsonb`, and bun:sql then
 * encodes the JS string as a JSON STRING, so the column stores
 * `"{\"path\":\"/x\"}"` (`jsonb_typeof = string`) and every extraction
 * operator (`->>`, `->`, `@>`) misses. `$1::text::jsonb` makes the parameter
 * `text`, which PostgreSQL then parses into JSON structure. Measured on
 * Bun 1.4.4 + drizzle-orm 1.0.0-rc.5 against PostgreSQL 16 and 17: objects,
 * arrays, scalars, JSON `null`, quotes, backslashes and non-BMP unicode all
 * store byte-identical to the former inlined `'…'::jsonb` literal.
 *
 * A JS `null` becomes the JSON value `null`, not SQL `NULL` — callers that
 * want SQL `NULL` pass `sql\`NULL\`` themselves.
 *
 * SQLite stores JSON as plain TEXT, so the serialised string binds as is.
 */
export const bindJsonbOn = (dialect: DatabaseDialect, value: unknown): SQL => {
  // @effect-diagnostics effect/preferSchemaOverJson:off
  const json = JSON.stringify(value)
  return dialect === 'sqlite' ? sql`${json}` : sql`${json}::text::jsonb`
}

/**
 * Bind a JS scalar array as a PostgreSQL `text[]` parameter.
 *
 * Multi-select fields and other array-shaped columns are `TEXT[]` on
 * PostgreSQL. bun:sql encodes a JS array parameter as a PostgreSQL array, so
 * the elements reach the column as bound data (standing rule S3); each one is
 * stringified first because the column is `text[]`. `sql.param` keeps Drizzle
 * from expanding the array into a comma list.
 *
 * SQLite has no array type: array columns hold a JSON array as TEXT, bound as
 * one serialised string.
 */
export const bindTextArrayOn = (
  dialect: DatabaseDialect,
  values: ReadonlyArray<string | number | boolean>
): SQL => {
  if (dialect === 'sqlite') {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    return sql`${JSON.stringify(values)}`
  }
  return sql`${sql.param(values.map(String))}::text[]`
}

/**
 * Normalize a `db.execute()` result into a plain rows array.
 *
 * Why this helper exists
 * ----------------------
 * drizzle-orm's result shape for raw `db.execute()` varies by driver:
 *   - `bun-sql` (Sovrium's production driver) returns the **rows array
 *     directly** — `Record<string, unknown>[]`.
 *   - `node-postgres` and several other drivers return a wrapper object
 *     `{ rows: [...] }`.
 *
 * Code that assumes only the `{ rows }` shape (`result.rows ?? []`) silently
 * gets `[]` under `bun-sql`, producing empty result sets with no error. This
 * helper accepts BOTH shapes so query code is driver-agnostic.
 *
 * This is the single canonical implementation — server route-setup files
 * (`schema-routes-core.ts`, `schema-routes-draft.ts`, `mcp/internals.ts`,
 * `mcp/schema-tool-call.ts`) import it from here rather than re-declaring it.
 */
export const extractRows = (result: unknown): ReadonlyArray<Record<string, unknown>> => {
  if (Array.isArray(result)) return result as ReadonlyArray<Record<string, unknown>>
  if (typeof result === 'object' && result !== null && 'rows' in result) {
    const wrapped = (result as { readonly rows?: unknown }).rows
    if (Array.isArray(wrapped)) return wrapped as ReadonlyArray<Record<string, unknown>>
  }
  return []
}
