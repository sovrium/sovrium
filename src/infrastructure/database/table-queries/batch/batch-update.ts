/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { findConstraintViolation } from '@/domain/errors/driver-failure'
import {
  db,
  ValidationError,
  type DrizzleTransaction,
  type DatabaseError,
} from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { injectUpdateAuthorship } from '../mutation-helpers/authorship-helpers'
import { fetchRecordByIdEffect } from '../mutation-helpers/record-fetch-helpers'
import { buildUpdateSetClauseCRUD } from '../mutation-helpers/update-helpers'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseErrorWithValidation } from '../shared/error-handling'
import { validateTableName } from '../shared/validation'
import { runEffectInTx } from './batch-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

const extractNotNullColumn = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  const postgres = message.match(/column "([^"]+)"/)
  if (postgres?.[1]) return postgres[1]
  const sqlite = message.match(/NOT NULL constraint failed:\s*[^.\s]+\.([^\s,]+)/i)
  return sqlite?.[1] ?? 'unknown'
}

function extractFieldsFromUpdate(update: {
  readonly id: string
  readonly fields?: Readonly<Record<string, unknown>>
}): Readonly<Record<string, unknown>> {
  return update.fields ?? {}
}

function executeRecordUpdate(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  setClause: Readonly<ReturnType<typeof sql.join>>
): Effect.Effect<Record<string, unknown> | undefined, ValidationError> {
  return Effect.tryPromise({
    try: async () => {
      const result = await executeRaw(
        tx,
        sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
      )
      return result[0]
    },
    catch: (error) => {
      if (findConstraintViolation(error) === 'not-null') {
        const fieldName = extractNotNullColumn(error)
        return new ValidationError(`Cannot set required field '${fieldName}' to null`, [
          { record: 0, field: fieldName, error: 'Required field cannot be null' },
        ])
      }
      return new ValidationError('Update failed due to constraint violation', [])
    },
  })
}

function updateSingleRecordInBatch(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  session: Readonly<Session>,
  update: { readonly id: string; readonly fields?: Record<string, unknown> }
): Effect.Effect<Record<string, unknown> | undefined, ValidationError> {
  return Effect.gen(function* () {
    const fieldsToUpdate = extractFieldsFromUpdate(update)

    if (Object.keys(fieldsToUpdate).length === 0) return undefined

    const fieldsWithAuthorship = yield* Effect.promise(() =>
      injectUpdateAuthorship(fieldsToUpdate, session.userId, tx, tableName)
    )

    const entries = Object.entries(fieldsWithAuthorship)
    const recordBefore = yield* fetchRecordByIdEffect(tx, tableName, update.id)
    const setClause = buildUpdateSetClauseCRUD(entries)
    const updatedRecord = yield* executeRecordUpdate(tx, tableName, update.id, setClause)

    if (updatedRecord) {
      yield* logActivity({
        session,
        tableName,
        action: 'update',
        recordId: String(update.id),
        changes: { before: recordBefore, after: updatedRecord },
      })
      return updatedRecord
    }

    return undefined
  })
}

export function batchUpdateRecords(
  session: Readonly<Session>,
  tableName: string,
  updates: readonly { readonly id: string; readonly fields?: Record<string, unknown> }[]
): Effect.Effect<readonly Record<string, unknown>[], DatabaseError | ValidationError> {
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        return await runEffectInTx(
          Effect.reduce(updates, [] as readonly Record<string, unknown>[], (acc, update) =>
            updateSingleRecordInBatch(tx, tableName, session, update).pipe(
              Effect.map((record) => (record ? [...acc, record] : acc))
            )
          )
        )
      }),
    catch: wrapDatabaseErrorWithValidation(`Failed to batch update records in ${tableName}`),
  })
}
