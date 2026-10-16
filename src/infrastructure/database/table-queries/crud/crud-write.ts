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
import { StaleWriteError } from '@/domain/errors'
import {
  ForeignKeyViolationError,
  type DatabaseError,
  type DrizzleTransaction,
  type UniqueConstraintViolationError,
} from '@/infrastructure/database'
import { traceDbQuery } from '@/infrastructure/telemetry/db-query-trace'
import { tryTransactionWithOutbox } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { confirmAccountsInTransaction } from '../mutation-helpers/account-confirmation'
import { injectCreateAuthorship } from '../mutation-helpers/authorship-helpers'
import { resolveArrayColumnTypes } from '../mutation-helpers/column-value-encoding'
import { buildInsertClauses, insertAndResolveRow } from '../mutation-helpers/create-record-helpers'
import {
  cascadeSoftDelete,
  cascadeSetNull,
  checkRestrictConstraint,
  executeSoftDelete,
  executeHardDelete,
  checkDeletedAtColumn,
} from '../mutation-helpers/delete-helpers'
import {
  writeManyToManyLinksInTransaction,
  type ManyToManyLink,
} from '../mutation-helpers/many-to-many-helpers'
import { fetchRecordById } from '../mutation-helpers/record-fetch-helpers'
import {
  runUpdateRecordTransaction,
  updateActivityChanges,
  type UpdateRecordInput,
} from '../mutation-helpers/update-transaction'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseError } from '../statement/error-handling'
import { wrapCreateRecordFailure } from './crud-write-failure'
import type { AccountReference } from '@/application/ports/repositories/tables/record-write-accounts'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Run the per-INSERT body inside a database transaction. Extracted so the
 * outer Effect program in `createRecord` stays under the
 * `max-lines-per-function` budget (50 lines) and so the introspection /
 * literal-encoding work stays close to the SQL it parameterises.
 */
async function executeCreateRecordTx(
  tx: Readonly<DrizzleTransaction>,
  session: Readonly<Session>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Promise<Readonly<Record<string, unknown>>> {
  const fieldsWithAuthorship = await injectCreateAuthorship(fields, session.userId, tx, tableName)
  // Introspect array-typed columns so multi-select (`text[]`) and JSONB
  // columns receiving arrays (e.g. `multiple-attachments`) get the
  // correct literal form. Only columns with array values need the
  // lookup, so the round-trip is skipped on the common scalar-only path.
  const arrayColumnTypes = await resolveArrayColumnTypes(tx, tableName, [fieldsWithAuthorship])
  const { columnsClause, valuesClause } = buildInsertClauses(fieldsWithAuthorship, arrayColumnTypes)
  // Execute the INSERT directly: this helper is already inside a promise the
  // caller's `Effect.tryPromise` owns, so there is no Effect to run here.
  // `RETURNING *` is supported by both PostgreSQL and SQLite (≥ 3.35). The view-backed-table write rule(b):
  // view-backed tables return a NULL id from the view — `insertAndResolveRow`
  // resolves the real base id and re-reads the row so create is uniform.
  return await insertAndResolveRow(tx, tableName, columnsClause, valuesClause)
}

/**
 * The create transaction: the row, then the many-to-many links it names, on the
 * same `tx`. A refused link throws out of the body, so the driver rolls back the
 * row with it — a create answered with an error keeps nothing.
 */
async function executeCreateRecordWithLinksTx(
  tx: Readonly<DrizzleTransaction>,
  input: {
    readonly session: Readonly<Session>
    readonly tableName: string
    readonly fields: Readonly<Record<string, unknown>>
    readonly links: readonly ManyToManyLink[]
    readonly accounts?: readonly AccountReference[]
  }
): Promise<Readonly<Record<string, unknown>>> {
  const { session, tableName, fields, links } = input
  await confirmAccountsInTransaction(tx, input.accounts)
  const row = await executeCreateRecordTx(tx, session, tableName, fields)
  const sourceId = row['id'] as string | number
  return writeManyToManyLinksInTransaction(tx, { sourceTable: tableName, sourceId, links }).then(
    () => row
  )
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
export function createRecord(
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
> {
  return Effect.gen(function* () {
    const record = yield* traceDbQuery(
      'insert',
      tableName,
      tryTransactionWithOutbox({
        transaction: (tx) =>
          executeCreateRecordWithLinksTx(tx, {
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
    yield* logActivity({
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
function logRecordUpdateActivity(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly changes: Record<string, unknown>
  readonly app?: App
}): Effect.Effect<void, never> {
  const { session, tableName, recordId, changes, app } = config
  return logActivity({
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
export function updateRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  params: Readonly<UpdateRecordInput>
): Effect.Effect<
  Record<string, unknown>,
  DatabaseError | StaleWriteError | ForeignKeyViolationError
> {
  const wrap = wrapDatabaseError(`Failed to update record in ${tableName}`)
  return Effect.gen(function* () {
    const { recordBefore, updatedRecord, rowWritten } = yield* traceDbQuery(
      'update',
      tableName,
      tryTransactionWithOutbox({
        transaction: (tx) =>
          runUpdateRecordTransaction(tx, { session, tableName, recordId }, params),
        changesOf: (outcome) => updatedRowChanges(tableName, recordId, outcome),
        catch: (error) =>
          error instanceof StaleWriteError || error instanceof ForeignKeyViolationError
            ? error
            : wrap(error),
      })
    )
    if (!rowWritten) return updatedRecord

    yield* logRecordUpdateActivity({
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
 * App schema slice consumed by the delete pipeline. Only the fields needed
 * for cascade / set-null / restrict checks are surfaced.
 */
type DeleteAppSchema = {
  readonly tables?: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
      readonly relatedTable?: string
      readonly onDelete?: string
    }>
  }>
}

/**
 * Outcome of the delete transaction. `recordBeforeData` is non-undefined only
 * on the soft-delete success path; `restrictViolation` short-circuits before
 * any rows are touched.
 */
type DeleteTransactionOutcome = {
  readonly success: boolean
  readonly recordBeforeData: Record<string, unknown> | undefined
  readonly setNullPerformed: boolean
  readonly restrictViolation: boolean
  /** Every row the delete removed or changed — the record and its cascaded children. */
  readonly committed: readonly CommittedRowChange[]
}

/**
 * Single-arg config for the delete transaction so the helper stays under
 * `max-params`. All fields are immutable inputs.
 */
type DeleteTransactionConfig = {
  readonly tx: DrizzleTransaction
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly app: DeleteAppSchema | undefined
}

/**
 * Execute the delete pipeline within a single transaction:
 * 1. Reject restrict-on-delete violations deterministically.
 * 2. Pick soft-delete vs hard-delete based on the `deleted_at` column.
 * 3. On soft-delete success, cascade to dependents and run set-null helpers.
 *
 * Extracted from `deleteRecord` so the inner generator stays small enough to
 * satisfy `max-lines-per-function` without a lint disable.
 */
async function runDeleteTransaction(
  config: Readonly<DeleteTransactionConfig>
): Promise<DeleteTransactionOutcome> {
  const { tx, session, tableName, recordId, app } = config

  if (app) {
    const isRestricted = await checkRestrictConstraint(tx, tableName, recordId, app)
    if (isRestricted) {
      return {
        success: false,
        recordBeforeData: undefined,
        setNullPerformed: false,
        restrictViolation: true,
        committed: [],
      }
    }
  }

  const hasSoftDelete = await checkDeletedAtColumn(tx, tableName)
  const recordBeforeData = await fetchRecordById(tx, tableName, recordId)

  const removedRecord = (): readonly CommittedRowChange[] =>
    recordBeforeData === undefined
      ? []
      : [{ tableName, event: 'delete', recordId, previous: recordBeforeData }]

  if (!hasSoftDelete) {
    const success = await executeHardDelete(tx, tableName, recordId)
    return {
      success,
      recordBeforeData: undefined,
      setNullPerformed: false,
      restrictViolation: false,
      committed: success ? removedRecord() : [],
    }
  }

  const success = await executeSoftDelete(tx, tableName, recordId, session.userId)
  if (!success) {
    return {
      success: false,
      recordBeforeData: undefined,
      setNullPerformed: false,
      restrictViolation: false,
      committed: [],
    }
  }

  const cascaded = app ? await cascadeSoftDelete(tx, tableName, recordId, app, session.userId) : []
  const setNull = app
    ? await cascadeSetNull(tx, tableName, recordId, app)
    : { performed: false, changes: [] }
  return {
    success: true,
    recordBeforeData,
    setNullPerformed: setNull.performed,
    restrictViolation: false,
    committed: [...removedRecord(), ...cascaded, ...setNull.changes],
  }
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
 * @param app - App schema (optional, for cascade delete logic)
 * @returns Effect resolving to success boolean
 */
export function deleteRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  app?: DeleteAppSchema
): Effect.Effect<
  { success: boolean; setNullPerformed: boolean; restrictViolation: boolean },
  DatabaseError
> {
  return Effect.gen(function* () {
    const result = yield* traceDbQuery(
      'delete',
      tableName,
      tryTransactionWithOutbox({
        transaction: (tx) => runDeleteTransaction({ tx, session, tableName, recordId, app }),
        changesOf: (outcome) => outcome.committed,
        catch: wrapDatabaseError(`Failed to delete record from ${tableName}`),
      })
    )

    if (result.success && result.recordBeforeData) {
      yield* logActivity({
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
 * @returns Effect resolving to success boolean
 */
export function permanentlyDeleteRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, DatabaseError> {
  return Effect.gen(function* () {
    const result = yield* traceDbQuery(
      'delete',
      tableName,
      tryTransactionWithOutbox({
        transaction: async (tx) => {
          // Fetch record before deletion for activity logging
          const recordBeforeData = await fetchRecordById(tx, tableName, recordId)
          const success = await executeHardDelete(tx, tableName, recordId)
          return { success, recordBeforeData: success ? recordBeforeData : undefined }
        },
        changesOf: ({ recordBeforeData: previous }) =>
          previous === undefined ? [] : [{ tableName, event: 'delete', recordId, previous }],
        catch: wrapDatabaseError(`Failed to permanently delete record from ${tableName}`),
      })
    )

    // Log activity for permanent delete (outside transaction)
    if (result.success && result.recordBeforeData) {
      yield* logActivity({
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
