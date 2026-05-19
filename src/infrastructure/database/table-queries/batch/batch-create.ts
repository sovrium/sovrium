/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { db, SessionContextError } from '@/infrastructure/database'
import { injectCreateAuthorship } from '../mutation-helpers/authorship-helpers'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseErrorWithValidation } from '../shared/error-handling'
import { validateTableName } from '../shared/validation'
import { createSingleRecordInBatch, runEffectInTx } from './batch-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { ValidationError } from '@/infrastructure/database'

export function batchCreateRecords(
  session: Readonly<Session>,
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError | ValidationError> {
  return Effect.gen(function* () {
    const createdRecords = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)

          if (recordsData.length === 0) {
            throw new SessionContextError('Cannot create batch with no records', undefined)
          }

          const recordsWithAuthorship = await Promise.all(
            recordsData.map((fields) =>
              injectCreateAuthorship(fields, session.userId, tx, tableName)
            )
          )

          return await runEffectInTx(
            Effect.reduce(
              recordsWithAuthorship,
              [] as readonly Record<string, unknown>[],
              (acc, fields) =>
                createSingleRecordInBatch(tx, tableName, fields).pipe(
                  Effect.map((record) => (record ? [...acc, record] : acc))
                )
            )
          )
        }),
      catch: wrapDatabaseErrorWithValidation(`Failed to create batch records in ${tableName}`),
    })

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
