/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { DatabaseError } from '@/domain/errors'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '../statement/validation'
import type { TransactionOn } from '@/infrastructure/database/drizzle/layer'

/**
 * Fetch a single record by ID (Promise-based for transaction use)
 *
 * Used before mutations (update/delete) for activity logging.
 * Throws DatabaseError on database failure.
 */
export async function fetchRecordById(
  { tx, dialect }: TransactionOn,
  tableName: string,
  recordId: string
): Promise<Record<string, unknown> | undefined> {
  try {
    const result = await executeRawOn(
      dialect.kind,
      tx,
      sql`SELECT * FROM ${tableIdentifier(tableName)} WHERE id = ${recordId} LIMIT 1`
    )
    return result[0]
  } catch (error) {
    throw new DatabaseError(`Failed to fetch record ${recordId}`, error)
  }
}

/**
 * Fetch multiple records by IDs (Effect-based for batch operations)
 *
 * Fails with DatabaseError on database failure.
 */
export function fetchRecordsByIds(
  { tx, dialect }: TransactionOn,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<readonly Record<string, unknown>[], DatabaseError> {
  return Effect.tryPromise({
    try: async () => {
      const idParams = sql.join(
        recordIds.map((id) => sql`${id}`),
        sql.raw(', ')
      )
      const result = await executeRawOn(
        dialect.kind,
        tx,
        sql`SELECT * FROM ${tableIdentifier(tableName)} WHERE id IN (${idParams})`
      )
      return result
    },
    catch: (error) => new DatabaseError('Failed to fetch records before operation', error),
  })
}

/**
 * The row a write hands back, as a read right after it sees the row.
 *
 * SQLite's `RETURNING` reports the row as it stood BEFORE its `AFTER` triggers
 * ran — and on SQLite the trigger-computed formulas and the `updated_at` stamp
 * are written by `AFTER` triggers — so a create answered a formula as `null`
 * and an update answered the previous modification time. On SQLite the row is
 * therefore read again by its id. PostgreSQL computes both in `BEFORE`
 * triggers, which `RETURNING` already reflects, so its row is kept as it is.
 */
export async function rowAfterTriggers(
  { tx, dialect }: TransactionOn,
  tableName: string,
  row: Readonly<Record<string, unknown>>
): Promise<Readonly<Record<string, unknown>>> {
  const { id } = row
  if (dialect.kind !== 'sqlite' || id === undefined || id === null) return row
  const [reread] = await executeRawOn(
    dialect.kind,
    tx,
    sql`SELECT * FROM ${tableIdentifier(tableName)} WHERE id = ${id} LIMIT 1`
  )
  return reread ?? row
}
