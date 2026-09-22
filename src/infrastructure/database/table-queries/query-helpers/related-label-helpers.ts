/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db, type DatabaseError } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { wrapDatabaseError } from '../statement/error-handling'
import { validateColumnName, validateTableName } from '../statement/validation'

/**
 * Reading the human label behind a relationship's stored key.
 *
 * A relationship column holds the related row's identifier and nothing else, so
 * a read surface showing that column verbatim shows a number. A field declaring
 * `displayField` has already named the column that identifies the related row
 * to a person; this resolves it, keeping the identifier itself untouched so the
 * write path, filters and editors go on seeing the key they store.
 *
 * Sibling of `readManyToMany` in shape and in constraints: one query per
 * (table, column) pair with every referenced id collapsed into a single
 * `IN (...)`, on the shared connection pool, on the record-list hot path.
 */

/** Junction and key columns are declared `INTEGER`; coerce numeric-looking ids. */
const coerceId = (value: string | number): string | number =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value

/**
 * Width of the per-request fan-out.
 *
 * Bounded for the same reason `readManyToMany` is: the width is a function of
 * how many relationship columns a table declares, and the 2026-07-25
 * pool-exhaustion incident established that "bounded by configuration" is not a
 * safety argument on the shared pool. Two matches the DB-bound precedent used
 * across the read helpers, leaving eight of the ten default pool slots free.
 */
const LABEL_FANOUT_CONCURRENCY = 2

/** One related table's labels to resolve, for a known set of referenced ids. */
export interface RelatedLabelRequest {
  readonly relatedTable: string
  readonly displayField: string
  readonly ids: readonly (string | number)[]
}

/**
 * Resolved labels, keyed `"<relatedTable>.<displayField>" -> id -> label`.
 *
 * Keyed on the pair rather than on the source field name so two columns
 * pointing at the same table through the same display column share one query
 * and one entry.
 */
export type RelatedLabelMap = Record<string, Record<string, string>>

/** The map key for one (table, column) pair. */
const relatedLabelKey = (relatedTable: string, displayField: string): string =>
  `${relatedTable}.${displayField}`

/** SELECT the id/label pairs for one related table. */
const readLabelRows = (
  request: RelatedLabelRequest
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  validateTableName(request.relatedTable)
  validateColumnName(request.displayField)
  const idList = sql.join(
    request.ids.map((id) => sql`${coerceId(id)}`),
    sql.raw(', ')
  )
  return executeRaw(
    db,
    sql`SELECT id AS related_id, ${sql.identifier(request.displayField)} AS label FROM ${sql.identifier(request.relatedTable)} WHERE id IN (${idList})`
  )
}

/** Fold one table's rows into `id -> label`, dropping rows with no label. */
const foldLabelRows = (
  rows: ReadonlyArray<Record<string, unknown>>
): Readonly<Record<string, string>> =>
  rows.reduce<Record<string, string>>((acc, row) => {
    const { label, related_id: relatedId } = row
    if (label === null || label === undefined || label === '') return acc
    return { ...acc, [String(relatedId)]: String(label) }
  }, {})

/**
 * Resolve the display labels for every requested relationship target.
 *
 * A referenced row that no longer exists, or whose display column is empty,
 * simply has no entry — callers fall back to the stored identifier rather than
 * rendering a blank cell, so a dangling link stays visible as a link.
 */
export const readRelatedLabels = (
  requests: readonly RelatedLabelRequest[]
): Effect.Effect<RelatedLabelMap, DatabaseError> => {
  const wanted = requests.filter((r) => r.ids.length > 0)
  if (wanted.length === 0) return Effect.succeed({})
  return Effect.all(
    wanted.map((request) =>
      Effect.tryPromise({
        try: async () => ({
          request,
          byId: foldLabelRows(await readLabelRows(request)),
        }),
        catch: wrapDatabaseError(`Failed to read related labels for ${request.relatedTable}`),
      })
    ),
    { concurrency: LABEL_FANOUT_CONCURRENCY }
  ).pipe(
    Effect.map((resolved) =>
      resolved.reduce<RelatedLabelMap>(
        (acc, { request, byId }) => ({
          ...acc,
          [relatedLabelKey(request.relatedTable, request.displayField)]: byId,
        }),
        {}
      )
    )
  )
}
