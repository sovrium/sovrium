/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { db, DatabaseError } from '@/infrastructure/database'
import { injectCreateAuthorship } from '../mutation-helpers/authorship-helpers'
import { resolveArrayColumnTypes } from '../mutation-helpers/column-value-encoding'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseErrorWithValidation } from '../shared/error-handling'
import { validateTableName } from '../shared/validation'
import { BATCH_FANOUT_CONCURRENCY, createSingleRecordInBatch, runEffectInTx } from './batch-helpers'
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
 * `DatabaseError` / `ValidationError` UNCHANGED when handed one, so a
 * rejection wrapped here, re-thrown by `runEffectInTx` via `Cause.squash`, and
 * caught out there passes straight through rather than being wrapped twice.
 */
const injectAuthorshipForBatch = (
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  userId: string | undefined,
  recordsData: readonly Record<string, unknown>[]
): Promise<readonly Record<string, unknown>[]> =>
  runEffectInTx(
    Effect.all(
      recordsData.map((fields) =>
        Effect.tryPromise({
          try: () => injectCreateAuthorship(fields, userId, tx, tableName),
          catch: wrapDatabaseErrorWithValidation(batchCreateFailure(tableName)),
        })
      ),
      { concurrency: BATCH_FANOUT_CONCURRENCY }
    )
  )

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
  recordsData: readonly Record<string, unknown>[]
): Effect.Effect<readonly Record<string, unknown>[], DatabaseError | ValidationError> {
  return Effect.gen(function* () {
    const createdRecords = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)

          if (recordsData.length === 0) {
            // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
            throw new DatabaseError('Cannot create batch with no records', undefined)
          }

          // Inject authorship metadata for each record — bounded fan-out, see
          // `injectAuthorshipForBatch`.
          const recordsWithAuthorship = await injectAuthorshipForBatch(
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
          const arrayColumnTypes = await resolveArrayColumnTypes(
            tx,
            tableName,
            recordsWithAuthorship
          )

          // Use Effect.reduce with runEffectInTx to properly propagate ValidationError
          return await runEffectInTx(
            Effect.reduce(
              recordsWithAuthorship,
              [] as readonly Record<string, unknown>[],
              (acc, fields) =>
                createSingleRecordInBatch(tx, tableName, fields, arrayColumnTypes).pipe(
                  Effect.map((record) => (record ? [...acc, record] : acc))
                )
            )
          )
        }),
      catch: wrapDatabaseErrorWithValidation(batchCreateFailure(tableName)),
    })

    // Log activity for each created record
    yield* Effect.forEach(createdRecords, (record) =>
      logActivity({
        session,
        tableName,
        action: 'create',
        recordId: String(record.id),
        changes: { after: record },
      })
    ).pipe(Effect.asVoid)

    return createdRecords
  })
}
