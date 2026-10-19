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
import { tableIdentifier, validateColumnName } from '../statement/validation'

/** One `one-to-many` field to resolve: the related table and its key back here. */
export interface OneToManyFieldRequest {
  readonly fieldName: string
  readonly relatedTable: string
  /** The related table's many-to-one column that points at the source record. */
  readonly reciprocalField: string
}

/** The records to resolve, and the one-to-many fields to resolve them for. */
export interface ReadOneToManyInput {
  readonly sourceIds: readonly (string | number)[]
  readonly fields: readonly OneToManyFieldRequest[]
}

/** `recordId -> fieldName -> relatedIds`, every source record present. */
export type OneToManyResult = Record<string, Record<string, readonly string[]>>

/** Two related tables read at a time, like the junction read beside it. */
const READ_FIELD_FANOUT_CONCURRENCY = 2

/**
 * The live rows of `relatedTable` whose `reciprocalField` names one of
 * `sourceIds`, as `(related id, source id)` pairs in id order.
 *
 * Every id is bound (S3) and the key is compared as text, so one statement
 * serves an integer key and a text key alike, on both engines. A soft-deleted
 * row is not a link any more and is left out.
 */
const readFieldRows = (
  sourceIds: readonly (string | number)[],
  field: OneToManyFieldRequest
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  validateColumnName(field.reciprocalField)
  const ids = sql.join(
    sourceIds.map((id) => sql`${String(id)}`),
    sql.raw(', ')
  )
  const key = sql.identifier(field.reciprocalField)
  return executeRaw(
    db,
    sql`SELECT id AS related_id, CAST(${key} AS TEXT) AS source_id FROM ${tableIdentifier(field.relatedTable)} WHERE CAST(${key} AS TEXT) IN (${ids}) AND ${sql.identifier('deleted_at')} IS NULL ORDER BY id`
  )
}

/** Fold one field's pairs into `recordId -> relatedIds`, every source record seeded empty. */
const foldFieldRows = (
  sourceIds: readonly (string | number)[],
  rows: ReadonlyArray<Record<string, unknown>>
): Readonly<Record<string, readonly string[]>> =>
  rows.reduce<Record<string, readonly string[]>>(
    (acc, row) => {
      const source = String(row['source_id'])
      return { ...acc, [source]: [...(acc[source] ?? []), String(row['related_id'])] }
    },
    Object.fromEntries(sourceIds.map((id) => [String(id), []]))
  )

/**
 * Resolve `one-to-many` field values — the records of another table that point
 * at each source record through its `reciprocalField`.
 *
 * Such a field has no column of its own: the link is stored on the OTHER side,
 * so a `SELECT *` of the source table never returns it. Every source record
 * gets every requested field, empty when nothing points at it, so a list reads
 * "none" rather than "unknown".
 */
export const readOneToMany = (
  input: ReadOneToManyInput
): Effect.Effect<OneToManyResult, DatabaseError> => {
  if (input.fields.length === 0 || input.sourceIds.length === 0) return Effect.succeed({})
  return Effect.forEach(
    input.fields,
    (field) =>
      Effect.tryPromise({
        try: async () => ({
          field,
          byRecord: foldFieldRows(input.sourceIds, await readFieldRows(input.sourceIds, field)),
        }),
        catch: wrapDatabaseError(`Failed to read one-to-many records of ${field.relatedTable}`),
      }),
    { concurrency: READ_FIELD_FANOUT_CONCURRENCY }
  ).pipe(
    Effect.map((perField) =>
      perField.reduce<OneToManyResult>(
        (acc, { field, byRecord }) =>
          Object.entries(byRecord).reduce<OneToManyResult>(
            (inner, [recordId, ids]) => ({
              ...inner,
              [recordId]: { ...inner[recordId], [field.fieldName]: ids },
            }),
            acc
          ),
        {}
      )
    )
  )
}
