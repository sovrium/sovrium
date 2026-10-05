/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { reportCommittedRows } from '@/application/ports/services/record-change-feed'
import { db, DatabaseError } from '@/infrastructure/database'
import { withTransaction } from '@/infrastructure/database/transaction'
import { injectCreateAuthorship } from '../mutation-helpers/authorship-helpers'
import { resolveArrayColumnTypes } from '../mutation-helpers/column-value-encoding'
import { writeManyToManyLinksInTransaction } from '../mutation-helpers/many-to-many-helpers'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseError, wrapDatabaseErrorWithValidation } from '../statement/error-handling'
import { BATCH_FANOUT_CONCURRENCY, createSingleRecordInBatch } from './batch-helpers'
import type { BatchCreateLink } from '@/application/ports/repositories/tables/batch-repository'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { DrizzleTransaction, ValidationError } from '@/infrastructure/database'

/** Message used for BOTH the per-record and the whole-transaction failure wrap. */
const batchCreateFailure = (tableName: string): string =>
  `Failed to create batch records in ${tableName}`

/**
 * Inject authorship metadata into every record of the batch.
 *
 * FAN-OUT WIDTH: `BATCH_FANOUT_CONCURRENCY` — one catalog probe per record, so
 * the width is input-size bounded (the caller's batch). Capped rather than left
 * to a raw `Promise.all`; see that constant for why the transaction's single
 * connection makes 2 the right ceiling.
 *
 * ORDER: `Effect.all` preserves array order exactly as `Promise.all` did, which
 * matters — the returned array is fed straight into the INSERT reduce below, so
 * its order is the insertion order.
 *
 * ERRORS: the `catch` reuses the SAME wrapper and message as
 * `batchCreateRecords`'s outer catch, which makes the conversion
 * error-identical. `wrapDatabaseErrorWithValidation` returns a
 * `DatabaseError` / `ValidationError` UNCHANGED when handed one, so a failure
 * raised here passes straight through the outer handler rather than being
 * wrapped twice.
 */
const injectAuthorshipForBatch = (
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  userId: string | undefined,
  recordsData: readonly Record<string, unknown>[]
): Effect.Effect<readonly Record<string, unknown>[], DatabaseError | ValidationError> =>
  Effect.forEach(
    recordsData,
    (fields) =>
      Effect.tryPromise({
        try: () => injectCreateAuthorship(fields, userId, tx, tableName),
        catch: wrapDatabaseErrorWithValidation(batchCreateFailure(tableName)),
      }),
    { concurrency: BATCH_FANOUT_CONCURRENCY }
  )

/**
 * Once the batch has committed: log each created record on the activity trail,
 * and report it to the change stream.
 */
function settleCreatedRecords(
  session: Readonly<Session>,
  tableName: string,
  createdRecords: readonly Record<string, unknown>[]
): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* Effect.forEach(createdRecords, (record) =>
      logActivity({
        session,
        tableName,
        action: 'create',
        recordId: String(record.id),
        changes: { after: record },
      })
    ).pipe(Effect.asVoid)
    yield* reportCommittedRows(
      createdRecords.map((row) => ({
        tableName,
        event: 'insert' as const,
        recordId: String(row['id']),
        row,
      }))
    )
  })
}

/**
 * Write one created record's many-to-many links on the batch's transaction.
 *
 * Paired with the record at the moment it is created — never by its position
 * in the returned list, which skips a record that had nothing to insert — and
 * on the same transaction, so a link that cannot be written rolls the whole
 * batch back rather than leaving its records unlinked.
 */
const linkCreatedRecord = (
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  record: Readonly<Record<string, unknown>>,
  links: readonly BatchCreateLink[]
): Effect.Effect<void, DatabaseError> =>
  links.length === 0
    ? Effect.void
    : Effect.tryPromise({
        try: () =>
          writeManyToManyLinksInTransaction(tx, {
            sourceTable: tableName,
            sourceId: record['id'] as string | number,
            links,
          }),
        catch: wrapDatabaseError(`Failed to link many-to-many records for ${tableName}`),
      }).pipe(Effect.asVoid)

/**
 * Batch create records
 *
 * Creates multiple records in a single transaction.
 * Permissions applied via application layer.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordsData - Array of field objects to insert
 * @returns Effect resolving to array of created records
 */
export function batchCreateRecords(
  session: Readonly<Session>,
  tableName: string,
  recordsData: readonly Record<string, unknown>[],
  links?: readonly (readonly BatchCreateLink[])[]
): Effect.Effect<readonly Record<string, unknown>[], DatabaseError | ValidationError> {
  return Effect.gen(function* () {
    const onFailure = wrapDatabaseErrorWithValidation(batchCreateFailure(tableName))
    const createdRecords = yield* withTransaction(
      db,
      (tx) =>
        Effect.gen(function* () {
          if (recordsData.length === 0) {
            return yield* Effect.fail(
              new DatabaseError('Cannot create batch with no records', undefined)
            )
          }

          // Inject authorship metadata for each record — bounded fan-out, see
          // `injectAuthorshipForBatch`.
          const recordsWithAuthorship = yield* injectAuthorshipForBatch(
            tx,
            tableName,
            session.userId,
            recordsData
          )

          // Resolve the encoding for every array-shaped column ONCE for the
          // whole batch. The records all land in the same table, so a single
          // introspection round-trip over the union of array column names
          // answers each record's question — and the lookup short-circuits to
          // `{}` when the batch is scalar-only (the common case) or the engine
          // is SQLite (no native array type).
          const arrayColumnTypes = yield* Effect.tryPromise({
            try: () => resolveArrayColumnTypes(tx, tableName, recordsWithAuthorship),
            catch: onFailure,
          })

          return yield* Effect.reduce(
            recordsWithAuthorship.map((fields, index) => ({ fields, index })),
            () => [] as readonly Record<string, unknown>[],
            (acc, { fields, index }) =>
              createSingleRecordInBatch(tx, tableName, fields, arrayColumnTypes).pipe(
                Effect.tap((record) =>
                  record === undefined
                    ? Effect.void
                    : linkCreatedRecord(tx, tableName, record, links?.[index] ?? [])
                ),
                Effect.map((record) => (record ? [...acc, record] : acc))
              )
          )
        }),
      onFailure
    )

    yield* settleCreatedRecords(session, tableName, createdRecords)

    return createdRecords
  })
}
