/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  reportCommittedRows,
  type CommittedRowChange,
} from '@/application/ports/services/record-change-feed'
import { type DatabaseError, type DrizzleTransaction } from '@/infrastructure/database'
import { columnExists } from '@/infrastructure/database/sql/dialect-introspection'
import { traceDbQuery } from '@/infrastructure/telemetry/db-query-trace'
import { tryTransactionWithOutbox } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseError } from '../statement/error-handling'
import { typedExecute } from '../statement/typed-execute'
import { tableIdentifier, databaseTableName } from '../statement/validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/** The restore transaction: the row back out of the trash, or a marker saying why not. */
async function runRestoreTransaction(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Promise<Record<string, unknown> | null> {
  const tableIdent = tableIdentifier(tableName)

  // Check if record exists (including soft-deleted records)
  const checkResult = await typedExecute(
    tx,
    sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
  )

  if (checkResult.length === 0) {
    return null // Record not found
  }

  const record = checkResult[0]

  // Check if record is soft-deleted
  if (!record?.deleted_at) {
    // Record exists but is not deleted - return error via special marker
    return { _error: 'not_deleted' } as Record<string, unknown>
  }

  // Check if table has deleted_by column (dialect-aware introspection)
  const hasDeletedBy = await columnExists(tx, databaseTableName(tableName), 'deleted_by')

  // Restore record by clearing deleted_at and deleted_by (if column exists)
  const result = hasDeletedBy
    ? await typedExecute(
        tx,
        sql`UPDATE ${tableIdent} SET deleted_at = NULL, deleted_by = NULL WHERE id = ${recordId} RETURNING *`
      )
    : await typedExecute(
        tx,
        sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id = ${recordId} RETURNING *`
      )

  return result[0] ?? {}
}

/**
 * Restore a soft-deleted record
 *
 * Clears the deleted_at timestamp to restore a soft-deleted record.
 * Returns error if record doesn't exist or is not soft-deleted.
 * Permissions applied via application layer.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @returns Effect resolving to restored record or null
 */
export function restoreRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, DatabaseError> {
  return Effect.gen(function* () {
    const restoredRecord = yield* traceDbQuery(
      'update',
      tableName,
      tryTransactionWithOutbox({
        transaction: (tx) => runRestoreTransaction(tx, tableName, recordId),
        // A restored row comes back into view: an insert, the inverse of the delete.
        changesOf: (row): readonly CommittedRowChange[] =>
          row?.['id'] === undefined ? [] : [{ tableName, event: 'insert', recordId, row }],
        catch: wrapDatabaseError(`Failed to restore record ${recordId} from ${tableName}`),
      })
    )

    // Log activity for record restoration (outside transaction)
    if (restoredRecord && !('_error' in restoredRecord)) {
      yield* logActivity({
        session,
        tableName,
        action: 'restore',
        recordId,
        changes: { after: restoredRecord },
      })
      // A restored row comes back into view: announced as an insert, the
      // inverse of the delete that took it out.
      if (restoredRecord['id'] !== undefined) {
        yield* reportCommittedRows([{ tableName, event: 'insert', recordId, row: restoredRecord }])
      }
    }

    return restoredRecord
  })
}
