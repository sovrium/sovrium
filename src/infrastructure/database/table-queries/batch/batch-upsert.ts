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
import { DatabaseError, ValidationError, type DrizzleTransaction } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { listTableColumns } from '@/infrastructure/database/sql/dialect-introspection'
import { withOutboxTransaction } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { injectCreateAuthorship } from '../mutation-helpers/authorship-helpers'
import { resolveArrayColumnTypes } from '../mutation-helpers/column-value-encoding'
import { rowAfterTriggers } from '../mutation-helpers/record-fetch-helpers'
import { buildUpdateSetClauseCRUD } from '../mutation-helpers/update-helpers'
import { logCommittedRowChanges } from '../query-helpers/activity-log-helpers'
import { excludingIds } from '../query-helpers/check-existing-records'
import { validateColumnName, tableIdentifier, databaseTableName } from '../statement/validation'
import { BatchValidationError, createSingleRecord } from './batch-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Helper to update existing record
 *
 * The SET clause comes from the SINGLE shared builder
 * (`buildUpdateSetClauseCRUD`), the one the CRUD update and `batch-update`
 * already use. A private copy binding every value with `sql\`${value}\`` breaks
 * arrays, because drizzle expands a JS array into a SQL ROW CONSTRUCTOR —
 * `['a','b']` becomes `($1, $2)`. Array-valued fields (`multi-select`,
 * `multiple-attachments`, any JSON column holding an array) would then fail by
 * ARITY rather than by type: two or more elements raise a row-constructor
 * error, an empty array produces invalid syntax, and a ONE-element array binds
 * to `($1)` — legal scalar syntax — so the upsert answers 200 and silently
 * stores the bare string where the array belongs.
 *
 * Any path that COPIES the clause builder instead of calling it is exposed to
 * the same defect, so every path delegates.
 */
async function updateSingleRecord(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  params: {
    readonly fields: Record<string, unknown>
    readonly fieldsToMergeOn: readonly string[]
    readonly insertOnlyFields: readonly string[]
  }
): Promise<Record<string, unknown> | undefined> {
  // A merge key is already equal, and an insert-only column (creation date,
  // created-by author) describes the row's creation, which happened once: an
  // update rewrites neither. SQLite has no trigger to restore `created_at`, so
  // dropping it here is what keeps the rule on both engines.
  const updateEntries = Object.entries(params.fields).filter(
    ([key]) => !params.fieldsToMergeOn.includes(key) && !params.insertOnlyFields.includes(key)
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
    sql`UPDATE ${tableIdentifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
  )

  const [updated] = result
  return updated === undefined ? undefined : { ...(await rowAfterTriggers(tx, tableName, updated)) }
}

type UpsertResult = {
  readonly records: readonly Record<string, unknown>[]
  readonly created: number
  readonly updated: number
  /** Every row the upsert wrote, reported once the transaction commits. */
  readonly committed: readonly CommittedRowChange[]
}

/** The accumulator after one row was written — counted, echoed, and kept for the change stream. */
const withCommitted = (
  acc: UpsertResult,
  kind: 'created' | 'updated',
  change: CommittedRowChange & { readonly row: Record<string, unknown> }
): UpsertResult => ({
  records: [...acc.records, change.row],
  created: acc.created + (kind === 'created' ? 1 : 0),
  updated: acc.updated + (kind === 'updated' ? 1 : 0),
  committed: [...acc.committed, change],
})

/**
 * Check if record exists based on merge fields. A row the caller's row-level
 * read rule hides (`hiddenIds`) is not a match: the record is created instead.
 */
function findExistingRecord(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>,
  merge: { readonly fieldsToMergeOn: readonly string[]; readonly hiddenIds: readonly string[] }
): Effect.Effect<Readonly<Record<string, unknown>> | undefined, DatabaseError> {
  const { fieldsToMergeOn, hiddenIds } = merge
  const whereConditions = fieldsToMergeOn.map((field) => {
    validateColumnName(field)
    return sql`${sql.identifier(field)} = ${fields[field]}`
  })
  const whereClause = sql.join(whereConditions, sql.raw(' AND '))

  return Effect.tryPromise({
    try: async () => {
      const result = await executeRaw(
        tx,
        sql`SELECT * FROM ${tableIdentifier(tableName)}
             WHERE ${whereClause}${excludingIds(hiddenIds)} LIMIT 1`
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
    readonly insertOnlyFields: readonly string[]
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
          insertOnlyFields: params.insertOnlyFields,
        }),
      catch: (error) => new DatabaseError(`Failed to update record in ${params.tableName}`, error),
    })

    if (!updated) {
      return {
        records: [...params.acc.records, params.existing],
        created: params.acc.created,
        updated: params.acc.updated + 1,
        committed: params.acc.committed,
      }
    }

    return withCommitted(params.acc, 'updated', {
      tableName: params.tableName,
      event: 'update',
      recordId,
      row: updated,
      previous: params.existing,
    })
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
      try: async () => {
        // The literal `created_by`/`updated_by` columns get the session's
        // author, exactly as batch create does — without it an upsert into a
        // table with a NOT NULL author column could never insert.
        const fields = await injectCreateAuthorship(
          params.fields,
          params.session.userId,
          tx,
          params.tableName
        )
        return createSingleRecord(
          tx,
          params.tableName,
          fields,
          // Same array-encoding resolution the batch-create path uses. Scoped
          // to this record because upsert interleaves creates with updates, so
          // there is no batch-wide column union to hoist; the lookup skips its
          // round-trip when nothing here is array-shaped.
          await resolveArrayColumnTypes(tx, params.tableName, [fields])
        )
      },
      catch: (error) => {
        // If this is a ValidationError, propagate it as-is
        if (error instanceof ValidationError) {
          return error
        }
        return new DatabaseError(`Failed to create record in ${params.tableName}`, error)
      },
    })

    if (!created) return params.acc

    return withCommitted(params.acc, 'created', {
      tableName: params.tableName,
      event: 'insert',
      recordId: String(created.id),
      row: created,
    })
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
    readonly insertOnlyFields: readonly string[]
    readonly hiddenIds: readonly string[]
    readonly acc: UpsertResult
  }
): Effect.Effect<UpsertResult, DatabaseError | ValidationError> {
  return Effect.gen(function* () {
    const existing = yield* findExistingRecord(tx, params.tableName, params.fields, params)

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
 * The columns a create must supply: NOT NULL columns that have no DB-side
 * default, minus the system fields the insert fills itself. Queried ONCE per
 * batch (dialect-aware) — the table's shape does not change between records.
 */
async function requiredFieldsOf(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<readonly string[]> {
  const columns = await listTableColumns(tx, databaseTableName(tableName))
  // System fields that are auto-generated (exclude from validation). The
  // literal author columns are filled by `injectCreateAuthorship` on insert.
  const autoFields = new Set(['id', 'created_at', 'updated_at', 'created_by', 'updated_by'])
  return columns
    .filter((col) => !col.isNullable && col.columnDefault === null)
    .map((col) => col.name)
    .filter((field) => !autoFields.has(field))
}

/** The required fields a record (for creates) lacks — a NOT NULL violation in waiting. */
const missingRequiredFieldsIn = (
  requiredFields: readonly string[],
  record: Readonly<Record<string, unknown>>,
  recordIndex: number
): readonly string[] => {
  const missingFields = requiredFields.filter((field) => !(field in record))
  return missingFields.length > 0
    ? [`Record ${recordIndex}: Missing required field(s) ${missingFields.join(', ')}`]
    : []
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
    if (recordsData.length === 0) return
    const requiredFields = yield* Effect.tryPromise({
      try: () => requiredFieldsOf(tx, tableName),
      catch: (error) =>
        new BatchValidationError({
          message: 'Failed to validate record',
          details: [String(error)],
        }),
    })
    const allErrors = recordsData.flatMap((record, index) =>
      missingRequiredFieldsIn(requiredFields, record, index)
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
  options: {
    readonly fieldsToMergeOn: readonly string[]
    readonly insertOnlyFields?: readonly string[]
    readonly hiddenIds?: readonly string[]
  }
): Effect.Effect<
  Omit<UpsertResult, 'committed'>,
  DatabaseError | BatchValidationError | ValidationError
> {
  const { fieldsToMergeOn, insertOnlyFields = [], hiddenIds = [] } = options
  return Effect.gen(function* () {
    if (recordsData.length === 0) {
      return yield* Effect.fail(new DatabaseError('Cannot upsert batch with no records', undefined))
    }

    if (fieldsToMergeOn.length === 0) {
      return yield* Effect.fail(new DatabaseError('Cannot upsert without merge fields', undefined))
    }

    fieldsToMergeOn.forEach((field) => validateColumnName(field))

    // Validate merge fields are present in all records BEFORE processing
    yield* validateMergeFieldsPresent(recordsData, fieldsToMergeOn)

    const merge = { fieldsToMergeOn, insertOnlyFields, hiddenIds }
    const result = yield* withOutboxTransaction((upserted: UpsertResult) => upserted.committed)(
      (tx) =>
        Effect.gen(function* () {
          yield* validateAllRecordsHaveRequiredFields(tx, tableName, recordsData)

          return yield* Effect.reduce(
            recordsData,
            () => ({ records: [], created: 0, updated: 0, committed: [] }) as UpsertResult,
            (acc, fields) => processSingleUpsert(tx, { session, tableName, fields, ...merge, acc })
          )
        }),
      (error) => {
        if (error instanceof DatabaseError) return error
        // A constraint rejection from the create branch arrives typed, carrying
        // the client-safe wording from `CONSTRAINT_MESSAGES`. Falling through to
        // the wrap below would, because `ValidationError` carries no `cause`,
        // produce a `DatabaseError` with a dead chain — which `sanitizeError`
        // can only read as an unexplained fault and answer 500. The SAME caller
        // mistake would then be a 400 through batch create and a 500 through
        // upsert, blaming the caller on one route and paging the operator on
        // the other. The return type already admitted this class.
        if (error instanceof ValidationError) return error
        if (error instanceof BatchValidationError) {
          // Re-wrap BatchValidationError as DatabaseError to match return type
          return new DatabaseError(error.message, error)
        }
        return new DatabaseError(`Failed to upsert records in ${tableName}`, error)
      }
    )

    const { committed, ...outcome } = result
    // Logged once the transaction has committed — a rolled-back batch changed nothing.
    yield* logCommittedRowChanges(session, committed)
    yield* reportCommittedRows(committed)
    return outcome
  })
}
