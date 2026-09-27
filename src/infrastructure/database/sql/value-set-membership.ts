/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type Column, type Name, type SQL } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/**
 * `column IN (<values>)` for a value set of ANY size, bound as ONE parameter.
 *
 * drizzle's `inArray` binds one placeholder per value, and both engines cap the
 * placeholders a single statement may carry — SQLite at 32,766, PostgreSQL's
 * wire protocol at 65,535. Past that the statement does not degrade, it FAILS,
 * taking the whole query with it. A value set whose size is data-driven (every
 * key an attachment cell names, say) will cross that line on an ordinary
 * install, so it cannot be bound value by value.
 *
 * Instead the set travels as a single JSON array text parameter and the engine
 * unpacks it into a relation:
 *
 * - PostgreSQL: `IN (SELECT jsonb_array_elements_text($1::text::jsonb))`. The
 *   `::text` is load-bearing: with a bare `$1::jsonb` the server infers the
 *   parameter as `jsonb`, `bun:sql` then JSON-encodes the already-encoded
 *   string, and the array arrives as a JSON string SCALAR ("cannot extract
 *   elements from a scalar"). Caught by the system-bucket E2E specs.
 * - SQLite: `IN (SELECT value FROM json_each(?))` — JSON1 is compiled into
 *   `bun:sqlite`.
 *
 * Both remain parameterised (standing rule S3): the values are data inside one
 * bound string, never spliced into the statement text. Membership, ordering,
 * `LIMIT` and aggregates all stay in the one query, so a caller keeps its sort,
 * cursor and totals exactly as it had them with `inArray`.
 *
 * An empty set yields an empty relation, so the predicate is simply false.
 */
/* eslint-disable-next-line functional/prefer-immutable-types -- SQL / Column / Name are upstream drizzle-orm types (structurally mutable); this builder returns them untouched */
export const isInValueSet = (column: SQL | Column | Name, values: readonly string[]): SQL => {
  const encoded = JSON.stringify(values)
  if (parseDatabaseDialectConfig().dialect === 'sqlite') {
    return sql`${column} IN (SELECT value FROM json_each(${encoded}))`
  }
  return sql`${column} IN (SELECT jsonb_array_elements_text(${encoded}::text::jsonb))`
}
