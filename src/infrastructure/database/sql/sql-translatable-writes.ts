/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { bindJsonbOn } from './sql-utils'
import type { LanguageMerge } from '@/domain/models/app/tables/translatable-write-service'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/**
 * The SQL a write to a translatable field becomes: the languages it sets and
 * removes, merged into the stored map INSIDE the statement.
 *
 * Merging in the statement, rather than reading the map and writing back the
 * whole of it, is what keeps two concurrent writers of two languages from
 * erasing each other: the read and the write are one expression evaluated on
 * the row as the statement locks it, so no other write lands between them.
 *
 * - PostgreSQL: `(stored || set) - removed…` on `jsonb`;
 * - SQLite: `json_patch(stored, patch)` — RFC 7396 merge patch, whose `null`
 *   removes a key — on the JSON text.
 *
 * Either way a stored value that is not a map (`NULL`, or a scalar written
 * before the field was translatable) merges as an empty map, and a map left
 * with no language is stored as `NULL`, the empty value every other read
 * already expects.
 *
 * The map binds through {@link bindJsonb}, the encoder every JSON write
 * shares; each removed language code is bound too.
 */
export const languageMergeSql = (
  dialect: DatabaseDialect,
  column: string,
  merge: LanguageMerge
): Readonly<SQL> => {
  const target = sql.identifier(column)
  if (dialect === 'sqlite') {
    const patch = { ...merge.set, ...Object.fromEntries(merge.remove.map((code) => [code, null])) }
    const stored = sql`CASE WHEN json_type(${target}) = 'object' THEN ${target} ELSE '{}' END`
    return sql`NULLIF(json_patch(${stored}, ${bindJsonbOn(dialect, patch)}), '{}')`
  }
  const stored = sql`CASE WHEN jsonb_typeof(${target}) = 'object' THEN ${target} ELSE '{}'::jsonb END`
  const removals = merge.remove.map((code) => sql` - ${code}::text`)
  const merged = sql`(${stored} || ${bindJsonbOn(dialect, merge.set)})${sql.join(removals)}`
  return sql`NULLIF(${merged}, '{}'::jsonb)`
}

/**
 * The value a write to a translatable field inserts: the map it sets, or
 * `NULL` when it sets no language — a new record has no map to merge into.
 */
export const languageMergeInsertSql = (
  dialect: DatabaseDialect,
  merge: LanguageMerge
): Readonly<SQL> =>
  Object.keys(merge.set).length === 0 ? sql`NULL` : bindJsonbOn(dialect, merge.set)
