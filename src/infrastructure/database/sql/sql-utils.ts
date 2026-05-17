/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { escapeSqlString } from '@/domain/utils/sql-formatting'

// Re-export from domain layer — these are pure string transformations
export { escapeSqlString, formatSqlValue, formatLikePattern } from '@/domain/utils/sql-formatting'

/**
 * Inline a JS value as a JSONB literal in a Drizzle SQL fragment, working
 * around drizzle-orm + bun-sql's TEXT-bind behaviour for `jsonb` columns.
 *
 * Why this helper exists
 * ----------------------
 * drizzle-orm + bun-sql encodes any string parameter sent to a jsonb column
 * as a TEXT-typed bind. PostgreSQL then receives the JSON-as-TEXT and casts
 * it via the SUPER conversion, which produces a JSONB STRING (e.g.
 * `"{\"path\":\"/x\"}"`) — NOT a JSONB OBJECT (`{path:"/x"}`). The string
 * form passes `pg_typeof = jsonb` and `jsonb_typeof = string`, but breaks
 * every JSONB extraction operator (`->>`, `->`, `@>`).
 *
 * Things that DO NOT fix this:
 *   - `column: { ... }` via `db.insert(...).values({...})` — drizzle
 *     JSON.stringify's the object, same TEXT-bind result.
 *   - `column: sql\`${JSON.stringify(o)}::jsonb\`` — the cast applies to the
 *     bound TEXT, but PG still parses it as a JSONB string.
 *   - `db.execute(sql\`... ${JSON.stringify(o)}::jsonb\`)` — same.
 *
 * What DOES fix this: inline the JSON literal as a SQL string with single
 * quotes escaped, then cast `::jsonb`. PG's parser sees the string token
 * directly and parses it as JSONB structure.
 *
 * SQL-injection safety
 * --------------------
 * `JSON.stringify` already escapes special characters (`"`, `\`, control
 * chars) within the JSON. The single remaining attack surface is `'`
 * (apostrophe), which `escapeSqlString` replaces with `''` per PostgreSQL's
 * standard string-literal escape rules (`standard_conforming_strings = on`,
 * the default since PG 9.1). The string is wrapped in plain `'...'`
 * delimiters (NOT `E'...'`), so backslashes inside the JSON literal are
 * not re-interpreted by the PG parser.
 *
 * Track upstream fix at https://github.com/drizzle-team/drizzle-orm/issues/4385
 * and https://github.com/oven-sh/bun.
 */
export const jsonbLiteral = (value: unknown) => {
  // @effect-diagnostics effect/preferSchemaOverJson:off
  const literal = escapeSqlString(JSON.stringify(value))
  return sql.raw(`'${literal}'::jsonb`)
}

/**
 * Inline a JS string array as a PostgreSQL `text[]` literal.
 *
 * Why this helper exists
 * ----------------------
 * Multi-select fields (`type: 'multi-select'`) and other array-shaped
 * columns are stored as `TEXT[]`, not `JSONB`. drizzle-orm + bun-sql does
 * not have a typed-array bind path for `TEXT[]`, and falling through to
 * `jsonbLiteral` (the default in `buildInsertClauses` for any object-shaped
 * value) produces a "column is of type text[] but expression is of type
 * jsonb" failure.
 *
 * Inlining the literal as `ARRAY['a', 'b']::text[]` sidesteps the bind by
 * letting PG's parser read the array structure directly. Per-element
 * `escapeSqlString` keeps the SQL-injection guarantees consistent with
 * `jsonbLiteral`.
 */
export const pgTextArrayLiteral = (values: ReadonlyArray<string | number | boolean>) => {
  if (values.length === 0) return sql.raw(`ARRAY[]::text[]`)
  const literal = values.map((v) => `'${escapeSqlString(String(v))}'`).join(', ')
  return sql.raw(`ARRAY[${literal}]::text[]`)
}
