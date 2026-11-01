/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { BatchValidationError } from '@/application/ports/repositories/tables/batch-repository'
import {
  reportCommittedRows,
  type CommittedRowChange,
} from '@/application/ports/services/record-change-feed'
import { BusinessRuleViolationError } from '@/domain/errors'
import { upsertUpdateChange } from '@/domain/models/app/tables/insert-only-field-service'
import { DatabaseError, ValidationError } from '@/infrastructure/database'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { withOutboxTransaction } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { confirmBatchAccounts } from '../mutation-helpers/account-confirmation'
import { injectCreateAuthorship } from '../mutation-helpers/authorship-helpers'
import { resolveArrayColumnTypes } from '../mutation-helpers/column-value-encoding'
import { rowAfterTriggers } from '../mutation-helpers/record-fetch-helpers'
import { buildUpdateSetClauseCRUD } from '../mutation-helpers/update-helpers'
import { logCommittedRowChanges } from '../query-helpers/activity-log-helpers'
import { validateColumnName, tableIdentifier } from '../statement/validation'
import { createSingleRecord } from './batch-helpers'
import {
  findExistingRecord,
  judgedCreate,
  judgedMatch,
  judgedUpsert,
} from './batch-upsert-judgement'
import {
  refuseEmptyUpsert,
  validateAllRecordsHaveRequiredFields,
  validateMergeFieldsPresent,
} from './batch-upsert-validation'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { AccountReference } from '@/application/ports/repositories/tables/record-write-accounts'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect, TransactionOn } from '@/infrastructure/database/drizzle/layer'

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
  on: TransactionOn,
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
  const updateEntries = Object.entries(upsertUpdateChange(params.fields, params))
  if (updateEntries.length === 0) return undefined

  // Same array-encoding resolution the create branch performs, and for the same
  // reason: a `text[]` column needs a native array literal, a `jsonb` one needs
  // JSON, and PostgreSQL rejects the wrong choice outright.
  const setClause = buildUpdateSetClauseCRUD(
    on.dialect.kind,
    updateEntries,
    await resolveArrayColumnTypes(on, tableName, [Object.fromEntries(updateEntries)])
  )

  const result = await executeRawOn(
    on.dialect.kind,
    on.tx,
    sql`UPDATE ${tableIdentifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
  )

  const [updated] = result
  return updated === undefined ? undefined : { ...(await rowAfterTriggers(on, tableName, updated)) }
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
 * Handle update path in upsert
 */
function handleUpsertUpdate(
  on: TransactionOn,
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
        updateSingleRecord(on, params.tableName, recordId, {
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
  on: TransactionOn,
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
          on,
          params.tableName
        )
        return createSingleRecord(
          on,
          params.tableName,
          fields,
          // Same array-encoding resolution the batch-create path uses. Scoped
          // to this record because upsert interleaves creates with updates, so
          // there is no batch-wide column union to hoist; the lookup skips its
          // round-trip when nothing here is array-shaped.
          await resolveArrayColumnTypes(on, params.tableName, [fields])
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
  on: TransactionOn,
  params: {
    readonly session: Readonly<Session>
    readonly tableName: string
    readonly fields: Record<string, unknown>
    readonly index: number
    readonly fieldsToMergeOn: readonly string[]
    readonly insertOnlyFields: readonly string[]
    readonly hiddenIds: readonly string[]
    readonly judge: InTransactionRuleJudge | undefined
    readonly acc: UpsertResult
  }
): Effect.Effect<UpsertResult, DatabaseError | ValidationError | BusinessRuleViolationError> {
  return Effect.gen(function* () {
    const existing = yield* findExistingRecord(on, params.tableName, params.fields, params)

    if (existing) {
      yield* judgedMatch(on, params.tableName, { index: params.index, existing }, params.judge)
      return yield* handleUpsertUpdate(on, { ...params, existing })
    }

    // No record matches — even one this row matched before the transaction
    // opened, since deleted or moved off the merge key: the row is judged as
    // the create it has become, on exactly the row it inserts.
    yield* judgedCreate({ index: params.index, fields: params.fields }, params.judge)
    return yield* handleUpsertCreate(on, params)
  })
}

/**
 * Every row of the upsert written in turn, inside its transaction: the rules
 * judged first on every row, as the update of the record it matches or the
 * create of the row it inserts, then each row matched again, judged once more
 * as what it has become, and written.
 */
const judgedUpsertRows = (
  on: TransactionOn,
  recordsData: readonly Record<string, unknown>[],
  write: Omit<Parameters<typeof processSingleUpsert>[1], 'fields' | 'index' | 'acc'>
) =>
  Effect.gen(function* () {
    const { tableName, judge } = write
    yield* judgedUpsert(on, tableName, recordsData, { merge: write, judge })
    return yield* Effect.reduce(
      recordsData,
      () => ({ records: [], created: 0, updated: 0, committed: [] }) as UpsertResult,
      (acc, fields, index) => processSingleUpsert(on, { ...write, fields, index, acc })
    )
  })

/**
 * Upsert records (create or update based on merge fields)
 */
export const upsertRecords =
  (db: PortableDb, dialect: Dialect) =>
  (
    session: Readonly<Session>,
    tableName: string,
    recordsData: readonly Record<string, unknown>[],
    options: {
      readonly fieldsToMergeOn: readonly string[]
      readonly insertOnlyFields?: readonly string[]
      readonly hiddenIds?: readonly string[]
      readonly accounts?: readonly AccountReference[]
      /** The rules, judged on every row inside the transaction (keyed by row position). */
      readonly judge?: InTransactionRuleJudge | undefined
    }
  ): Effect.Effect<
    Omit<UpsertResult, 'committed'>,
    DatabaseError | BatchValidationError | ValidationError | BusinessRuleViolationError
  > => {
    const { fieldsToMergeOn, insertOnlyFields = [], hiddenIds = [] } = options
    return Effect.gen(function* () {
      yield* refuseEmptyUpsert(recordsData, fieldsToMergeOn)
      fieldsToMergeOn.forEach((field) => validateColumnName(field))
      yield* validateMergeFieldsPresent(recordsData, fieldsToMergeOn)

      const merge = { fieldsToMergeOn, insertOnlyFields, hiddenIds }
      const write = { session, tableName, ...merge, judge: options.judge }
      const result = yield* withOutboxTransaction(
        { client: db, dialect },
        (upserted: UpsertResult) => upserted.committed
      )(
        (tx) =>
          Effect.gen(function* () {
            yield* confirmBatchAccounts(tx, dialect, options.accounts)
            yield* validateAllRecordsHaveRequiredFields({ tx, dialect }, tableName, recordsData)
            return yield* judgedUpsertRows({ tx, dialect }, recordsData, write)
          }),
        (error) => {
          if (error instanceof DatabaseError || error instanceof BusinessRuleViolationError) {
            return error
          }
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
      yield* logCommittedRowChanges(db, session, committed)
      yield* reportCommittedRows(committed)
      return outcome
    })
  }
