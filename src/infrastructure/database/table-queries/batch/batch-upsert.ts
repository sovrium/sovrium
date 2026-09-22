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
  DatabaseError,
  ValidationError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { listTableColumns } from '@/infrastructure/database/sql/dialect-introspection'
import { withTransaction } from '@/infrastructure/database/transaction'
import { resolveArrayColumnTypes } from '../mutation-helpers/column-value-encoding'
import { buildUpdateSetClauseCRUD } from '../mutation-helpers/update-helpers'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { validateTableName, validateColumnName } from '../statement/validation'
import { BatchValidationError, createSingleRecord } from './batch-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Helper to update existing record
 *
 * The SET clause comes from the SINGLE shared builder
 * (`buildUpdateSetClauseCRUD`), the one the CRUD update and `batch-update`
 * already use. This helper used to carry its own copy that bound every value
 * with `sql\`${value}\``, and drizzle expands a JS array into a SQL ROW
 * CONSTRUCTOR — `['a','b']` became `($1, $2)`. Array-valued fields
 * (`multi-select`, `multiple-attachments`, any JSON column holding an array)
 * therefore failed by ARITY rather than by type: two or more elements raised a
 * row-constructor error, an empty array produced invalid syntax, and a
 * ONE-element array bound to `($1)` — legal scalar syntax — so the upsert
 * answered 200 and silently stored the bare string where the array belonged.
 *
 * That is the same defect, through the same mechanism, that the batch CREATE
 * path carried: both had COPIED the clause builder instead of calling it.
 * Delegating is what stops a third copy from drifting back.
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

  // Same array-encoding resolution the create branch performs, and for the same
  // reason: a `text[]` column needs a native array literal, a `jsonb` one needs
  // JSON, and PostgreSQL rejects the wrong choice outright.
  const setClause = buildUpdateSetClauseCRUD(
    updateEntries,
    await resolveArrayColumnTypes(tx, tableName, [Object.fromEntries(updateEntries)])
  )

  const result = await executeRaw(
    tx,
    sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
  )

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
): Effect.Effect<Readonly<Record<string, unknown>> | undefined, DatabaseError> {
  const whereConditions = fieldsToMergeOn.map((field) => {
    validateColumnName(field)
    return sql`${sql.identifier(field)} = ${fields[field]}`
  })
  const whereClause = sql.join(whereConditions, sql.raw(' AND '))

  return Effect.tryPromise({
    try: async () => {
      const result = await executeRaw(
        tx,
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE ${whereClause} LIMIT 1`
      )
      return result[0]
    },
    catch: (error) => new DatabaseError(`Failed to check existing record in ${tableName}`, error),
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
): Effect.Effect<UpsertResult, DatabaseError> {
  return Effect.gen(function* () {
    const recordId = String(params.existing.id)
    const updated = yield* Effect.tryPromise({
      try: async () =>
        updateSingleRecord(tx, params.tableName, recordId, {
          fields: params.fields,
          fieldsToMergeOn: params.fieldsToMergeOn,
        }),
      catch: (error) => new DatabaseError(`Failed to update record in ${params.tableName}`, error),
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
): Effect.Effect<UpsertResult, DatabaseError | ValidationError> {
  return Effect.gen(function* () {
    const created = yield* Effect.tryPromise({
      try: async () =>
        createSingleRecord(
          tx,
          params.tableName,
          params.fields,
          // Same array-encoding resolution the batch-create path uses. Scoped
          // to this record because upsert interleaves creates with updates, so
          // there is no batch-wide column union to hoist; the lookup skips its
          // round-trip when nothing here is array-shaped.
          await resolveArrayColumnTypes(tx, params.tableName, [params.fields])
        ),
      catch: (error) => {
        // If this is a ValidationError, propagate it as-is
        if (error instanceof ValidationError) {
          return error
        }
        return new DatabaseError(`Failed to create record in ${params.tableName}`, error)
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
): Effect.Effect<UpsertResult, DatabaseError | ValidationError> {
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
  // Query table schema (dialect-aware) to get required fields: NOT NULL
  // columns that have no DB-side default.
  const columns = await listTableColumns(tx, tableName)
  const requiredFields = columns
    .filter((col) => !col.isNullable && col.columnDefault === null)
    .map((col) => col.name)

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
      () => [] as readonly string[],
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
): Effect.Effect<UpsertResult, DatabaseError | BatchValidationError | ValidationError> {
  return Effect.gen(function* () {
    validateTableName(tableName)

    if (recordsData.length === 0) {
      return yield* Effect.fail(new DatabaseError('Cannot upsert batch with no records', undefined))
    }

    if (fieldsToMergeOn.length === 0) {
      return yield* Effect.fail(new DatabaseError('Cannot upsert without merge fields', undefined))
    }

    fieldsToMergeOn.forEach((field) => validateColumnName(field))

    // Validate merge fields are present in all records BEFORE processing
    yield* validateMergeFieldsPresent(recordsData, fieldsToMergeOn)

    // Execute upsert in a transaction
    const result = yield* withTransaction(
      db,
      (tx) =>
        Effect.gen(function* () {
          yield* validateAllRecordsHaveRequiredFields(tx, tableName, recordsData)

          return yield* Effect.reduce(
            recordsData,
            () => ({ records: [], created: 0, updated: 0 }) as UpsertResult,
            (acc, fields) =>
              processSingleUpsert(tx, { session, tableName, fields, fieldsToMergeOn, acc })
          )
        }),
      (error) => {
        if (error instanceof DatabaseError) return error
        // A constraint rejection from the create branch arrives typed, carrying
        // the client-safe wording from `CONSTRAINT_MESSAGES`. It used to fall
        // through to the wrap below, and because `ValidationError` carries no
        // `cause` that wrap produced a `DatabaseError` with a dead chain — which
        // `sanitizeError` can only read as an unexplained fault and answer 500.
        // So the SAME caller mistake was a 400 through batch create and a 500
        // through upsert, blaming the caller on one route and paging the
        // operator on the other. The return type already admitted this class.
        if (error instanceof ValidationError) return error
        if (error instanceof BatchValidationError) {
          // Re-wrap BatchValidationError as DatabaseError to match return type
          return new DatabaseError(error.message, error)
        }
        return new DatabaseError(`Failed to upsert records in ${tableName}`, error)
      }
    )

    return result
  })
}
