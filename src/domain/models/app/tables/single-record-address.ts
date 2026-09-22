/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { tableHasIdColumn } from '@/domain/models/app/tables/searchable-text-columns'

/**
 * Whether a table's records can be addressed one at a time by a single value.
 *
 * `/api/tables/:tableId/records/:recordId` spends ONE path segment on the
 * record's identity, and every single-record verb resolves it as
 * `WHERE id = :recordId`. A table declaring a COMPOSITE primary key over
 * columns other than `id` has no `id` column at all — the DDL layer suppresses
 * the automatic one, because the composite constraint already keys the
 * relation — so that clause names a column that is not there and no value the
 * caller could put in the segment would ever match.
 *
 * The two engines fail that statement differently, which is why the class
 * survived a green suite: SQLite raises `no such column: id` and the request
 * ends as a 500, while PostgreSQL raises SQLSTATE 42703, which the driver-
 * failure sanitizer turns into a 400 blaming the caller for a column they never
 * sent. Neither answer is true — the request is well formed, and it is the
 * table's declared key that cannot be spelled in one segment.
 *
 * So the refusal is raised HERE, from the declared config, before any statement
 * is built. That is what makes the two engines agree: they agree by never
 * reaching the database, rather than by two sanitizers happening to phrase the
 * same driver error the same way.
 */

/** The minimal view of a table this rule needs. */
interface AddressableTable {
  readonly name: string
  readonly fields: readonly { readonly name: string; readonly type: string }[]
  readonly primaryKey?: { readonly type?: string; readonly fields?: readonly string[] }
}

/**
 * The message a single-record verb owes a table that has no single-value
 * address, or `undefined` when the table has one and the verb should proceed.
 *
 * The DECISION is delegated to {@link tableHasIdColumn} rather than restated:
 * that predicate is the domain-side mirror of `needsAutomaticIdColumn`, and its
 * parity with that authority is pinned by a test. Only the MESSAGE reads
 * `primaryKey.fields`, and only to enumerate the columns for the caller —
 * naming them is the whole point of the refusal, since no response available
 * today tells a caller what actually keys the row.
 *
 * Returns `undefined` for a table absent from the config: that is a
 * "table not found", which the routes already answer, and pre-empting it here
 * would turn a 404 into a 400.
 */
export const singleRecordAddressRefusal = (
  app: { readonly tables?: readonly AddressableTable[] } | undefined,
  tableName: string
): string | undefined => {
  const table = app?.tables?.find((candidate) => candidate.name === tableName)
  if (!table || tableHasIdColumn(table)) return undefined

  const keyColumns = table.primaryKey?.fields ?? []
  return (
    `Records of table "${tableName}" are keyed on (${keyColumns.join(', ')}) ` +
    `and cannot be addressed by a single id. ` +
    `List the records with a filter on those columns instead.`
  )
}
