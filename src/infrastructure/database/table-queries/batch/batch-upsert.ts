/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  db,
  SessionContextError,
  ValidationError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { typedExecute } from '../shared/typed-execute'
import { validateTableName, validateColumnName } from '../shared/validation'
import { BatchValidationError, runEffectInTx, createSingleRecord } from './batch-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Helper to update existing record
 */
async function updateSingleRecord(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  params: { readonly fields: Record<string, unknown>; readonly fieldsToMergeOn: readonly string[] }
): Promise<Record<string, unknown> | undefined> {
  const updateEntries = Object.entries(params.fields).filter(
    ([key]) => !params.fieldsToMergeOn.includes(key)
  )
  if (updateEntries.length === 0) return undefined

  const setExpressions = updateEntries.map(([key, value]) => {
    validateColumnName(key)
    return sql`${sql.identifier(key)} = ${value}`
  })
  const setClause = sql.join(setExpressions, sql.raw(', '))

  const result = (await tx.execute(
    sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
  )) as readonly Record<string, unknown>[]

  return result[0] ?? undefined
}

type UpsertResult = {
  readonly records: readonly Record<string, unknown>[]
  readonly created: number
  readonly updated: number
}

/**
 * Check if record exists based on merge fields
 */
function findExistingRecord(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>,
  fieldsToMergeOn: readonly string[]
): Effect.Effect<Readonly<Record<string, unknown>> | undefined, SessionContextError> {
  const whereConditions = fieldsToMergeOn.map((field) => {
    validateColumnName(field)
    return sql`${sql.identifier(field)} = ${fields[field]}`
  })
  const whereClause = sql.join(whereConditions, sql.raw(' AND '))

  return Effect.tryPromise({
    try: async () => {
      const result = (await tx.execute(
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE ${whereClause} LIMIT 1`
      )) as readonly Record<string, unknown>[]
      return result[0]
    },
    catch: (error) =>
      new SessionContextError(`Failed to check existing record in ${tableName}`, error),
  })
}

/**
 * Handle update path in upsert
 */
function handleUpsertUpdate(
  tx: Readonly<DrizzleTransaction>,
  params: {
    readonly session: Readonly<Session>
    readonly tableName: string
    readonly fields: Record<string, unknown>
    readonly fieldsToMergeOn: readonly string[]
    readonly existing: Record<string, unknown>
    readonly acc: UpsertResult
  }
): Effect.Effect<UpsertResult, SessionContextError> {
  return Effect.gen(function* () {
    const recordId = String(params.existing.id)
    const updated = yield* Effect.tryPromise({
      try: async () =>
        updateSingleRecord(tx, params.tableName, recordId, {
          fields: params.fields,
          fieldsToMergeOn: params.fieldsToMergeOn,
        }),
      catch: (error) =>
        new SessionContextError(`Failed to update record in ${params.tableName}`, error),
    })

    if (!updated) {
      return {
        records: [...params.acc.records, params.existing],
        created: params.acc.created,
        updated: params.acc.updated + 1,
      }
    }

    yield* logActivity({
      session: params.session,
      tableName: params.tableName,
      action: 'update',
      recordId,
      changes: { before: params.existing, after: updated },
    })

    return {
      records: [...params.acc.records, updated],
      created: params.acc.created,
      updated: params.acc.updated + 1,
    }
  })
}

/**
 * Handle create path in upsert
 */
function handleUpsertCreate(
  tx: Readonly<DrizzleTransaction>,
  params: {
    readonly session: Readonly<Session>
    readonly tableName: string
    readonly fields: Record<string, unknown>
    readonly acc: UpsertResult
  }
): Effect.Effect<UpsertResult, SessionContextError | ValidationError> {
  return Effect.gen(function* () {
    const created = yield* Effect.tryPromise({
      try: async () => createSingleRecord(tx, params.tableName, params.fields),
      catch: (error) => {
        // If this is a ValidationError, propagate it as-is
        if (error instanceof ValidationError) {
          return error
        }
        return new SessionContextError(`Failed to create record in ${params.tableName}`, error)
      },
    })

    if (!created) return params.acc

    yield* logActivity({
      session: params.session,
      tableName: params.tableName,
      action: 'create',
      recordId: String(created.id),
      changes: { after: created },
    })

    return {
      records: [...params.acc.records, created],
      created: params.acc.created + 1,
      updated: params.acc.updated,
    }
  })
}

/**
 * Process single upsert operation
 */
function processSingleUpsert(
  tx: Readonly<DrizzleTransaction>,
  params: {
    readonly session: Readonly<Session>
    readonly tableName: string
    readonly fields: Record<string, unknown>
    readonly fieldsToMergeOn: readonly string[]
    readonly acc: UpsertResult
  }
): Effect.Effect<UpsertResult, SessionContextError | ValidationError> {
  return Effect.gen(function* () {
    const existing = yield* findExistingRecord(
      tx,
      params.tableName,
      params.fields,
      params.fieldsToMergeOn
    )

    if (existing) {
      return yield* handleUpsertUpdate(tx, { ...params, existing })
    }

    return yield* handleUpsertCreate(tx, params)
  })
}

/**
 * Validate merge fields are present in all records
 */
function validateMergeFieldsPresent(
  recordsData: readonly Record<string, unknown>[],
  fieldsToMergeOn: readonly string[]
): Effect.Effect<void, BatchValidationError> {
  const errors = recordsData.flatMap((record, index) => {
    const missingFields = fieldsToMergeOn.filter((field) => !(field in record))
    return missingFields.length > 0
      ? [`Record ${index}: Missing merge field(s) ${missingFields.join(', ')}`]
      : []
  })

  if (errors.length > 0) {
    return Effect.fail(
      new BatchValidationError({
        message: 'Batch validation failed',
        details: errors,
      })
    )
  }

  return Effect.void
}

/**
 * Validate required fields are present in record (for creates)
 * This prevents database NOT NULL constraint violations
 */
async function validateRequiredFieldsInRecord(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  record: Readonly<Record<string, unknown>>,
  recordIndex: number
): Promise<readonly string[]> {
  // Query table schema to get required fields
  const schemaQuery = await typedExecute<{ column_name: string }>(
    tx,
    sql`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = ${tableName}
        AND table_schema = 'public'
        AND is_nullable = 'NO'
        AND column_default IS NULL
    `
  )

  const requiredFields = schemaQuery.map((row) => row.column_name)

  // System fields that are auto-generated (exclude from validation)
  const autoFields = new Set(['id', 'created_at', 'updated_at'])

  const missingFields = requiredFields.filter(
    (field) => !autoFields.has(field) && !(field in record)
  )

  if (missingFields.length > 0) {
    return [`Record ${recordIndex}: Missing required field(s) ${missingFields.join(', ')}`]
  }

  return []
}

/**
 * Validate all records have required fields BEFORE processing
 */
function validateAllRecordsHaveRequiredFields(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
): Effect.Effect<void, BatchValidationError> {
  return Effect.gen(function* () {
    const allErrors = yield* Effect.reduce(
      recordsData,
      [] as readonly string[],
      (acc, record, index) =>
        Effect.tryPromise({
          try: () => validateRequiredFieldsInRecord(tx, tableName, record, index),
          catch: (error) =>
            new BatchValidationError({
              message: 'Failed to validate record',
              details: [String(error)],
            }),
        }).pipe(Effect.map((recordErrors) => [...acc, ...recordErrors]))
    )

    if (allErrors.length > 0) {
      return yield* new BatchValidationError({
        message: 'Batch validation failed',
        details: allErrors,
      })
    }
  })
}

/**
 * Upsert records (create or update based on merge fields)
 */
export function upsertRecords(
  session: Readonly<Session>,
  tableName: string,
  recordsData: readonly Record<string, unknown>[],
  fieldsToMergeOn: readonly string[]
): Effect.Effect<UpsertResult, SessionContextError | BatchValidationError | ValidationError> {
  return Effect.gen(function* () {
    validateTableName(tableName)

    if (recordsData.length === 0) {
      return yield* Effect.fail(
        new SessionContextError('Cannot upsert batch with no records', undefined)
      )
    }

    if (fieldsToMergeOn.length === 0) {
      return yield* Effect.fail(
        new SessionContextError('Cannot upsert without merge fields', undefined)
      )
    }

    fieldsToMergeOn.forEach((field) => validateColumnName(field))

    // Validate merge fields are present in all records BEFORE processing
    yield* validateMergeFieldsPresent(recordsData, fieldsToMergeOn)

    // Execute upsert in a transaction
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          // eslint-disable-next-line functional/no-expression-statements -- Required for transaction validation
          await runEffectInTx(validateAllRecordsHaveRequiredFields(tx, tableName, recordsData))

          return await runEffectInTx(
            Effect.reduce(
              recordsData,
              { records: [], created: 0, updated: 0 } as UpsertResult,
              (acc, fields) =>
                processSingleUpsert(tx, { session, tableName, fields, fieldsToMergeOn, acc })
            )
          )
        }),
      catch: (error) => {
        if (error instanceof SessionContextError) return error
        if (error instanceof BatchValidationError) {
          // Re-wrap BatchValidationError as SessionContextError to match return type
          return new SessionContextError(error.message, error)
        }
        return new SessionContextError(`Failed to upsert records in ${tableName}`, error)
      },
    })

    return result
  })
}
