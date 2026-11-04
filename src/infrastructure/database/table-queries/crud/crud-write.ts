/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  reportCommittedRows,
  type CommittedRowChange,
} from '@/application/ports/services/record-change-feed'
import { BusinessRuleViolationError, StaleWriteError, ValidationError } from '@/domain/errors'
import {
  ForeignKeyViolationError,
  type DatabaseError,
  type PortableTx,
  type UniqueConstraintViolationError,
} from '@/infrastructure/database'
import { traceDbQuery } from '@/infrastructure/telemetry/db-query-trace'
import { tryTransactionWithOutbox } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { confirmAccountsInTransaction } from '../mutation-helpers/account-confirmation'
import { injectCreateAuthorship } from '../mutation-helpers/authorship-helpers'
import { resolveArrayColumnTypes } from '../mutation-helpers/column-value-encoding'
import { buildInsertClauses, insertAndResolveRow } from '../mutation-helpers/create-record-helpers'
import { executeHardDelete } from '../mutation-helpers/delete-helpers'
import { runDeleteTransaction, type DeleteAppSchema } from '../mutation-helpers/delete-transaction'
import {
  writeManyToManyLinksInTransaction,
  type ManyToManyLink,
} from '../mutation-helpers/many-to-many-helpers'
import { fetchRecordById } from '../mutation-helpers/record-fetch-helpers'
import {
  judgeInTransaction,
  judgePermanentDeleteInTransaction,
  refusalOr,
} from '../mutation-helpers/rule-judgement'
import {
  runUpdateRecordTransaction,
  updateActivityChanges,
  type UpdateRecordInput,
} from '../mutation-helpers/update-transaction'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseError } from '../statement/error-handling'
import { wrapCreateRecordFailure, wrapUpdateRecordFailure } from './crud-write-failure'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type {
  AccountReference,
  UpdateRecordFailure,
} from '@/application/ports/repositories/tables/record-write-accounts'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect, TransactionOn } from '@/infrastructure/database/drizzle/layer'

/**
 * Run the per-INSERT body inside a database transaction. Extracted so the
 * outer Effect program in `createRecord` stays under the
 * `max-lines-per-function` budget (50 lines) and so the introspection /
 * literal-encoding work stays close to the SQL it parameterises.
 */
async function executeCreateRecordTx(
  on: TransactionOn,
  session: Readonly<Session>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Promise<Readonly<Record<string, unknown>>> {
  const fieldsWithAuthorship = await injectCreateAuthorship(fields, session.userId, on, tableName)
  // Introspect array-typed columns so multi-select (`text[]`) and JSONB
  // columns receiving arrays (e.g. `multiple-attachments`) get the
  // correct literal form. Only columns with array values need the
  // lookup, so the round-trip is skipped on the common scalar-only path.
  const arrayColumnTypes = await resolveArrayColumnTypes(on, tableName, [fieldsWithAuthorship])
  const clauses = buildInsertClauses(on.dialect.kind, fieldsWithAuthorship, arrayColumnTypes)
  // Execute the INSERT directly: this helper is already inside a promise the
  // caller's `Effect.tryPromise` owns, so there is no Effect to run here.
  // `RETURNING *` is supported by both PostgreSQL and SQLite (≥ 3.35). The view-backed-table write rule(b):
  // view-backed tables return a NULL id from the view — `insertAndResolveRow`
  // resolves the real base id and re-reads the row so create is uniform.
  return await insertAndResolveRow(on, tableName, clauses)
}

/**
 * The create transaction: the row, then the many-to-many links it names, on the
 * same `tx`. A refused link throws out of the body, so the driver rolls back the
 * row with it — a create answered with an error keeps nothing.
 */
async function executeCreateRecordWithLinksTx(
  tx: Readonly<PortableTx>,
  dialect: Dialect,
  input: {
    readonly session: Readonly<Session>
    readonly tableName: string
    readonly fields: Readonly<Record<string, unknown>>
    readonly links: readonly ManyToManyLink[]
    readonly accounts?: readonly AccountReference[]
  }
): Promise<Readonly<Record<string, unknown>>> {
  const { session, tableName, fields, links } = input
  await confirmAccountsInTransaction(tx, dialect, input.accounts)
  const row = await executeCreateRecordTx({ tx, dialect }, session, tableName, fields)
  const sourceId = row['id'] as string | number
  return writeManyToManyLinksInTransaction(
    { tx, dialect },
    { sourceTable: tableName, sourceId, links }
  ).then(() => row)
}

/**
 * Create a new record
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param fields - Record fields
 * @param written - the many-to-many links to store with the record, and the accounts
 *   its lists of people name, both in the record's own transaction
 * @returns Effect resolving to created record
 */
export const createRecord =
  (db: PortableDb, dialect: Dialect) =>
  (
    session: Readonly<Session>,
    tableName: string,
    fields: Readonly<Record<string, unknown>>,
    written: {
      readonly links?: readonly ManyToManyLink[]
      readonly accounts?: readonly AccountReference[]
    } = {}
  ): Effect.Effect<
    Record<string, unknown>,
    DatabaseError | UniqueConstraintViolationError | ForeignKeyViolationError
  > => {
    return Effect.gen(function* () {
      const record = yield* traceDbQuery(
        'insert',
        tableName,
        tryTransactionWithOutbox({
          database: { client: db, dialect },
          transaction: (tx) =>
            executeCreateRecordWithLinksTx(tx, dialect, {
              ...{ session, tableName, fields, accounts: written.accounts },
              links: written.links ?? [],
            }),
          changesOf: (row) => [{ tableName, event: 'insert', recordId: String(row['id']), row }],
          // The caller's own keys, taken BEFORE authorship injection: only a
          // column they submitted may be named back to them (S4).
          catch: (error) => wrapCreateRecordFailure(error, tableName, Object.keys(fields)),
        })
      )

      // Log activity for record creation
      yield* logActivity(db, {
        session,
        tableName,
        action: 'create',
        recordId: String(record.id),
        changes: { after: record },
      })
      yield* reportCommittedRows([
        { tableName, event: 'insert', recordId: String(record.id), row: record },
      ])

      return record
    })
  }

/**
 * Log activity for record update
 */
function logRecordUpdateActivity(
  db: PortableDb,
  config: {
    readonly session: Readonly<Session>
    readonly tableName: string
    readonly recordId: string
    readonly changes: Record<string, unknown>
    readonly app?: App
  }
): Effect.Effect<void, never> {
  const { session, tableName, recordId, changes, app } = config
  return logActivity(db, {
    session,
    tableName,
    action: 'update',
    recordId,
    changes,
    app,
  })
}

/** The row an update wrote, when it wrote one — reported to the change stream and the outbox. */
const updatedRowChanges = (
  tableName: string,
  recordId: string,
  outcome: {
    readonly updatedRecord: Row
    readonly recordBefore: Row | undefined
    readonly rowWritten?: boolean
  }
): readonly CommittedRowChange[] =>
  outcome.rowWritten === false || outcome.updatedRecord['id'] === undefined
    ? []
    : [
        {
          tableName,
          event: 'update',
          recordId,
          row: outcome.updatedRecord,
          previous: outcome.recordBefore,
        },
      ]

type Row = Record<string, unknown>

/**
 * Update a record and its many-to-many links, all in one transaction.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param params - the columns to write, the links to add and remove, and the
 *   optimistic-lock token; with no columns only the links change
 * @returns Effect resolving to the updated record (`{}` for a links-only update
 *   of a record that does not exist)
 */
export const updateRecord =
  (db: PortableDb, dialect: Dialect) =>
  (
    session: Readonly<Session>,
    tableName: string,
    recordId: string,
    params: Readonly<UpdateRecordInput>
  ): Effect.Effect<Record<string, unknown>, UpdateRecordFailure> => {
    const wrap = wrapUpdateRecordFailure(tableName, Object.keys(params.fields))
    return Effect.gen(function* () {
      const { recordBefore, updatedRecord, rowWritten } = yield* traceDbQuery(
        'update',
        tableName,
        tryTransactionWithOutbox({
          database: { client: db, dialect },
          transaction: (tx) =>
            runUpdateRecordTransaction(tx, dialect, { session, tableName, recordId }, params),
          changesOf: (outcome) => updatedRowChanges(tableName, recordId, outcome),
          catch: (error) =>
            error instanceof StaleWriteError ||
            error instanceof ForeignKeyViolationError ||
            error instanceof BusinessRuleViolationError ||
            error instanceof ValidationError
              ? error
              : wrap(error),
        })
      )
      if (!rowWritten) return updatedRecord

      yield* logRecordUpdateActivity(db, {
        session,
        tableName,
        recordId,
        changes: updateActivityChanges(params, recordBefore, updatedRecord),
        app: params.app,
      })
      yield* reportCommittedRows(
        updatedRowChanges(tableName, recordId, { updatedRecord, recordBefore })
      )

      return updatedRecord
    })
  }

/**
 * Delete a record (soft delete if deleted_at field exists)
 *
 * Implements soft delete pattern:
 * - If table has deleted_at field: Sets deleted_at to NOW() (soft delete)
 * - If no deleted_at field: Performs hard delete
 * - Permissions applied via application layer
 * - Cascade soft delete to related records if configured with onDelete: 'cascade'
 * - Activity logging captures record state before deletion (non-blocking)
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param options - the app schema (for cascade delete logic) and the table's
 *   business rules, judged on the row inside the delete's transaction
 * @returns Effect resolving to success boolean
 */
export const deleteRecord =
  (db: PortableDb, dialect: Dialect) =>
  (
    session: Readonly<Session>,
    tableName: string,
    recordId: string,
    options: { readonly app?: DeleteAppSchema; readonly judge?: InTransactionRuleJudge } = {}
  ): Effect.Effect<
    { success: boolean; setNullPerformed: boolean; restrictViolation: boolean },
    DatabaseError | BusinessRuleViolationError
  > => {
    const { app, judge } = options
    return Effect.gen(function* () {
      const result = yield* traceDbQuery(
        'delete',
        tableName,
        tryTransactionWithOutbox({
          database: { client: db, dialect },
          // The rules first, on the row as this transaction reads it: a refusal removes nothing.
          transaction: async (tx) => {
            if (judge !== undefined) {
              await judgeInTransaction({ tx, dialect }, tableName, [recordId], judge)
            }
            return runDeleteTransaction({ tx, dialect, session, tableName, recordId, app })
          },
          changesOf: (outcome) => outcome.committed,
          catch: refusalOr(wrapDatabaseError(`Failed to delete record from ${tableName}`)),
        })
      )

      if (result.success && result.recordBeforeData) {
        yield* logActivity(db, {
          session,
          tableName,
          action: 'delete',
          recordId,
          changes: { before: result.recordBeforeData },
        })
      }
      yield* reportCommittedRows(result.committed)

      return {
        success: result.success,
        setNullPerformed: result.setNullPerformed,
        restrictViolation: result.restrictViolation,
      }
    })
  }

/**
 * Permanently delete a record (hard delete)
 *
 * Permanently removes the record from the database, regardless of deleted_at field.
 * This operation is irreversible and should only be allowed for admin roles.
 * Permissions applied via application layer.
 * Activity logging captures record state before deletion (non-blocking).
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param judge - the table's business rules, judged on the row inside the delete's transaction
 * @returns Effect resolving to success boolean
 */
export const permanentlyDeleteRecord =
  (db: PortableDb, dialect: Dialect) =>
  (
    session: Readonly<Session>,
    tableName: string,
    recordId: string,
    judge?: InTransactionRuleJudge
  ): Effect.Effect<boolean, DatabaseError | BusinessRuleViolationError> => {
    return Effect.gen(function* () {
      const result = yield* traceDbQuery(
        'delete',
        tableName,
        tryTransactionWithOutbox({
          database: { client: db, dialect },
          transaction: async (tx) => {
            // A row in the trash is judged too: deleting it for good is a delete.
            if (judge !== undefined) {
              await judgePermanentDeleteInTransaction({ tx, dialect }, tableName, [recordId], judge)
            }
            // Fetch record before deletion for activity logging
            const recordBeforeData = await fetchRecordById({ tx, dialect }, tableName, recordId)
            const success = await executeHardDelete({ tx, dialect }, tableName, recordId)
            return { success, recordBeforeData: success ? recordBeforeData : undefined }
          },
          changesOf: ({ recordBeforeData: previous }) =>
            previous === undefined ? [] : [{ tableName, event: 'delete', recordId, previous }],
          catch: refusalOr(
            wrapDatabaseError(`Failed to permanently delete record from ${tableName}`)
          ),
        })
      )

      // Log activity for permanent delete (outside transaction)
      if (result.success && result.recordBeforeData) {
        yield* logActivity(db, {
          session,
          tableName,
          action: 'permanent_delete',
          recordId,
          changes: { before: result.recordBeforeData },
        })
        yield* reportCommittedRows([
          { tableName, event: 'delete', recordId, previous: result.recordBeforeData },
        ])
      }

      return result.success
    })
  }
