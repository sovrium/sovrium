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
import { type DatabaseError, type PortableTx } from '@/infrastructure/database'
import { executeRawTypedOn } from '@/infrastructure/database/sql/dialect-execute'
import { columnExists } from '@/infrastructure/database/sql/dialect-introspection'
import { traceDbQuery } from '@/infrastructure/telemetry/db-query-trace'
import { tryTransactionWithOutbox } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { findRestoreUniqueConflict } from '../mutation-helpers/restore-unique-conflict'
import { judgeRestoreInTransaction, refusalOr } from '../mutation-helpers/rule-judgement'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseError } from '../statement/error-handling'
import { tableIdentifier, databaseTableName } from '../statement/validation'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { BusinessRuleViolationError } from '@/domain/errors'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect } from '@/infrastructure/database/drizzle/layer'

/** The restore transaction: the row back out of the trash, or a marker saying why not. */
async function runRestoreTransaction(
  tx: Readonly<PortableTx>,
  dialect: Dialect,
  tableName: string,
  restore: { readonly recordId: string; readonly judge: InTransactionRuleJudge | undefined }
): Promise<Record<string, unknown> | null> {
  const { recordId, judge } = restore
  const tableIdent = tableIdentifier(tableName)

  // The rules first, on the trashed row as it will stand restored, behind the
  // record's lock: a refusal brings nothing back. A row that is not in the
  // trash reaches the judge as absent, and is answered below.
  if (judge !== undefined) {
    await judgeRestoreInTransaction({ tx, dialect }, tableName, [recordId], judge)
  }

  // Check if record exists (including soft-deleted records)
  const checkResult = await executeRawTypedOn(
    dialect.kind,
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

  // A value of a unique field a live record has taken since: refused, never
  // duplicated (the record stays in the trash).
  const conflict = await findRestoreUniqueConflict(tx, dialect, tableName, [recordId])
  if (conflict !== undefined) return { _error: 'unique_conflict', field: conflict }

  // Check if table has deleted_by column (dialect-aware introspection)
  const hasDeletedBy = await columnExists(
    dialect.kind,
    tx,
    databaseTableName(tableName),
    'deleted_by'
  )

  // Restore record by clearing deleted_at and deleted_by (if column exists)
  const result = hasDeletedBy
    ? await executeRawTypedOn(
        dialect.kind,
        tx,
        sql`UPDATE ${tableIdent} SET deleted_at = NULL, deleted_by = NULL WHERE id = ${recordId} RETURNING *`
      )
    : await executeRawTypedOn(
        dialect.kind,
        tx,
        sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id = ${recordId} RETURNING *`
      )

  return result[0] ?? {}
}

/**
 * Restore a soft-deleted record
 *
 * Clears the deleted_at timestamp to restore a soft-deleted record.
 * Returns error if record doesn't exist or is not soft-deleted, and the marker
 * `{ _error: 'unique_conflict', field }` when a live record now holds its value
 * of a unique field.
 * Permissions applied via application layer.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param judge - the table's business rules, judged on the trashed row inside the restore's transaction
 * @returns Effect resolving to restored record or null
 */
export const restoreRecord =
  (db: PortableDb, dialect: Dialect) =>
  (
    session: Readonly<Session>,
    tableName: string,
    recordId: string,
    judge?: InTransactionRuleJudge
  ): Effect.Effect<Record<string, unknown> | null, DatabaseError | BusinessRuleViolationError> => {
    return Effect.gen(function* () {
      const restoredRecord = yield* traceDbQuery(
        'update',
        tableName,
        tryTransactionWithOutbox({
          database: { client: db, dialect },
          transaction: (tx) => runRestoreTransaction(tx, dialect, tableName, { recordId, judge }),
          // A restored row comes back into view: an insert, the inverse of the delete.
          changesOf: (row): readonly CommittedRowChange[] =>
            row?.['id'] === undefined ? [] : [{ tableName, event: 'insert', recordId, row }],
          catch: refusalOr(
            wrapDatabaseError(`Failed to restore record ${recordId} from ${tableName}`)
          ),
        })
      )

      // Log activity for record restoration (outside transaction)
      if (restoredRecord && !('_error' in restoredRecord)) {
        yield* logActivity(db, {
          session,
          tableName,
          action: 'restore',
          recordId,
          changes: { after: restoredRecord },
        })
        // A restored row comes back into view: announced as an insert, the
        // inverse of the delete that took it out.
        if (restoredRecord['id'] !== undefined) {
          yield* reportCommittedRows([
            { tableName, event: 'insert', recordId, row: restoredRecord },
          ])
        }
      }

      return restoredRecord
    })
  }
