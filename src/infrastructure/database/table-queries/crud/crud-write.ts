/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  db,
  ForeignKeyViolationError,
  SessionContextError,
  UniqueConstraintViolationError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { columnExists } from '@/infrastructure/database/sql/dialect-introspection'
import {
  injectCreateAuthorship,
  injectUpdateAuthorship,
} from '../mutation-helpers/authorship-helpers'
import {
  buildInsertClauses,
  isForeignKeyViolation,
  isUniqueConstraintViolation,
  lookupArrayColumnTypes,
} from '../mutation-helpers/create-record-helpers'
import {
  cascadeSoftDelete,
  cascadeSetNull,
  checkRestrictConstraint,
  executeSoftDelete,
  executeHardDelete,
  checkDeletedAtColumn,
} from '../mutation-helpers/delete-helpers'
import { fetchRecordById } from '../mutation-helpers/record-fetch-helpers'
import {
  validateFieldsNotEmpty,
  buildUpdateSetClauseCRUD,
  executeRecordUpdateCRUD,
} from '../mutation-helpers/update-helpers'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseError } from '../shared/error-handling'
import { typedExecute } from '../shared/typed-execute'
import { validateTableName } from '../shared/validation'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

async function executeCreateRecordTx(
  tx: Readonly<DrizzleTransaction>,
  session: Readonly<Session>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Promise<Readonly<Record<string, unknown>>> {
  validateTableName(tableName)
  if (Object.keys(fields).length === 0) {
    throw new SessionContextError('Cannot create record with no fields', undefined)
  }
  const fieldsWithAuthorship = await injectCreateAuthorship(fields, session.userId, tx, tableName)
  const arrayColumnNames = Object.entries(fieldsWithAuthorship)
    .filter(([, value]) => Array.isArray(value))
    .map(([key]) => key)
  const arrayColumnTypes = await lookupArrayColumnTypes(tx, tableName, arrayColumnNames)
  const { columnsClause, valuesClause } = buildInsertClauses(fieldsWithAuthorship, arrayColumnTypes)
  const insertResult = await executeRaw(
    tx,
    sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
  )
  return insertResult[0] ?? {}
}

function firstCapture(
  pattern: Readonly<RegExp>,
  sources: readonly (string | undefined)[]
): string | undefined {
  return sources
    .filter((s): s is string => typeof s === 'string')
    .map((s) => pattern.exec(s))
    .find((m): m is RegExpExecArray => m !== null && m[1] !== undefined)?.[1]
}

function extractFkFieldName(error: unknown): string | undefined {
  const err = error as
    | {
        readonly detail?: string
        readonly constraint?: string
        readonly message?: string
        readonly cause?: {
          readonly detail?: string
          readonly constraint?: string
          readonly message?: string
        }
      }
    | null
    | undefined
  if (err === null || err === undefined) return undefined
  const fromDetail = firstCapture(/Key \(([^)]+)\)=/, [
    err.detail,
    err.message,
    err.cause?.detail,
    err.cause?.message,
  ])
  if (fromDetail !== undefined) return fromDetail
  return firstCapture(/_([a-z][a-z0-9_]*)_fk(?:ey)?$/i, [err.constraint, err.cause?.constraint])
}

export function createRecord(
  session: Readonly<Session>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Effect.Effect<
  Record<string, unknown>,
  SessionContextError | UniqueConstraintViolationError | ForeignKeyViolationError
> {
  return Effect.gen(function* () {
    const record = yield* Effect.tryPromise({
      try: () => db.transaction((tx) => executeCreateRecordTx(tx, session, tableName, fields)),
      catch: (error) => {
        if (error instanceof SessionContextError) return error
        if (error instanceof UniqueConstraintViolationError) return error
        if (error instanceof ForeignKeyViolationError) return error
        if (isForeignKeyViolation(error)) {
          const fieldName = extractFkFieldName(error)
          const message = fieldName
            ? `referenced ${fieldName} does not exist`
            : 'referenced record does not exist'
          return new ForeignKeyViolationError(message, fieldName, error)
        }
        if (isUniqueConstraintViolation(error)) {
          return new UniqueConstraintViolationError('Unique constraint violation', error)
        }
        return new SessionContextError(`Failed to create record in ${tableName}`, error)
      },
    })

    yield* logActivity({
      session,
      tableName,
      action: 'create',
      recordId: String(record.id),
      changes: { after: record },
    })

    return record
  })
}

function logRecordUpdateActivity(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly changes: {
    readonly before: Record<string, unknown> | undefined
    readonly after: Record<string, unknown>
  }
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

export function updateRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  params: {
    readonly fields: Readonly<Record<string, unknown>>
    readonly app?: App
  }
): Effect.Effect<Record<string, unknown>, SessionContextError> {
  const { fields, app } = params
  return Effect.gen(function* () {
    const { recordBefore, updatedRecord } = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)

          const fieldsWithUpdatedBy = await injectUpdateAuthorship(
            fields,
            session.userId,
            tx,
            tableName
          )

          const entries = await validateFieldsNotEmpty(fieldsWithUpdatedBy)
          const before = await fetchRecordById(tx, tableName, recordId)
          const setClause = buildUpdateSetClauseCRUD(entries)
          const updated = await executeRecordUpdateCRUD(tx, tableName, recordId, setClause)
          return { recordBefore: before, updatedRecord: updated }
        }),
      catch: wrapDatabaseError(`Failed to update record in ${tableName}`),
    })

    yield* logRecordUpdateActivity({
      session,
      tableName,
      recordId,
      changes: {
        before: recordBefore,
        after: updatedRecord,
      },
      app,
    })

    return updatedRecord
  })
}

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

type DeleteTransactionOutcome = {
  readonly success: boolean
  readonly recordBeforeData: Record<string, unknown> | undefined
  readonly setNullPerformed: boolean
  readonly restrictViolation: boolean
}

type DeleteTransactionConfig = {
  readonly tx: DrizzleTransaction
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly app: DeleteAppSchema | undefined
}

async function runDeleteTransaction(
  config: Readonly<DeleteTransactionConfig>
): Promise<DeleteTransactionOutcome> {
  const { tx, session, tableName, recordId, app } = config
  validateTableName(tableName)

  if (app) {
    const isRestricted = await checkRestrictConstraint(tx, tableName, recordId, app)
    if (isRestricted) {
      return {
        success: false,
        recordBeforeData: undefined,
        setNullPerformed: false,
        restrictViolation: true,
      }
    }
  }

  const hasSoftDelete = await checkDeletedAtColumn(tx, tableName)
  const recordBeforeData = await fetchRecordById(tx, tableName, recordId)

  if (!hasSoftDelete) {
    const success = await executeHardDelete(tx, tableName, recordId)
    return {
      success,
      recordBeforeData: undefined,
      setNullPerformed: false,
      restrictViolation: false,
    }
  }

  const success = await executeSoftDelete(tx, tableName, recordId, session.userId)
  if (!success) {
    return {
      success: false,
      recordBeforeData: undefined,
      setNullPerformed: false,
      restrictViolation: false,
    }
  }

  if (app) {
    await cascadeSoftDelete(tx, tableName, recordId, app, session.userId)
  }

  const setNullPerformed = app ? await cascadeSetNull(tx, tableName, recordId, app) : false
  return { success: true, recordBeforeData, setNullPerformed, restrictViolation: false }
}

export function deleteRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  app?: DeleteAppSchema
): Effect.Effect<
  { success: boolean; setNullPerformed: boolean; restrictViolation: boolean },
  SessionContextError
> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction((tx) => runDeleteTransaction({ tx, session, tableName, recordId, app })),
      catch: wrapDatabaseError(`Failed to delete record from ${tableName}`),
    })

    if (result.success && result.recordBeforeData) {
      yield* logActivity({
        session,
        tableName,
        action: 'delete',
        recordId,
        changes: { before: result.recordBeforeData },
      })
    }

    return {
      success: result.success,
      setNullPerformed: result.setNullPerformed,
      restrictViolation: result.restrictViolation,
    }
  })
}

export function permanentlyDeleteRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, SessionContextError> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)

          const recordBeforeData = await fetchRecordById(tx, tableName, recordId)

          const success = await executeHardDelete(tx, tableName, recordId)

          return { success, recordBeforeData: success ? recordBeforeData : undefined }
        }),
      catch: wrapDatabaseError(`Failed to permanently delete record from ${tableName}`),
    })

    if (result.success && result.recordBeforeData) {
      yield* logActivity({
        session,
        tableName,
        action: 'permanent_delete',
        recordId,
        changes: { before: result.recordBeforeData },
      })
    }

    return result.success
  })
}

export function restoreRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return Effect.gen(function* () {
    const restoredRecord = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)
          const tableIdent = sql.identifier(tableName)

          const checkResult = await typedExecute(
            tx,
            sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
          )

          if (checkResult.length === 0) {
            return null
          }

          const record = checkResult[0]

          if (!record?.deleted_at) {
            return { _error: 'not_deleted' } as Record<string, unknown>
          }

          const hasDeletedBy = await columnExists(tx, tableName, 'deleted_by')

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
        }),
      catch: wrapDatabaseError(`Failed to restore record ${recordId} from ${tableName}`),
    })

    if (restoredRecord && !('_error' in restoredRecord)) {
      yield* logActivity({
        session,
        tableName,
        action: 'restore',
        recordId,
        changes: { after: restoredRecord },
      })
    }

    return restoredRecord
  })
}
