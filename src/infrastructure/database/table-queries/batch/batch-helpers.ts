/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Data, Effect, Exit, Cause } from 'effect'
import { findConstraintViolation } from '@/domain/errors/driver-failure'
import { ValidationError, type DrizzleTransaction } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { validateColumnName } from '../shared/validation'

export class BatchValidationError extends Data.TaggedError('BatchValidationError')<{
  readonly message: string
  readonly details?: readonly string[]
}> {}

export const BATCH_FANOUT_CONCURRENCY = 2

export async function runEffectInTx<A, E>(effect: Effect.Effect<A, E, never>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect)
  if (Exit.isSuccess(exit)) return exit.value
  throw Cause.squash(exit.cause)
}

function buildInsertClauses(fields: Readonly<Record<string, unknown>>):
  | {
      readonly columnsClause: ReturnType<typeof sql.join>
      readonly valuesClause: ReturnType<typeof sql.join>
    }
  | undefined {
  const entries = Object.entries(fields)
  if (entries.length === 0) return undefined

  const columnIdentifiers = entries.map(([key]) => {
    validateColumnName(key)
    return sql.identifier(key)
  })
  const valueParams = entries.map(([, value]) => sql`${value}`)

  return {
    columnsClause: sql.join(columnIdentifiers, sql.raw(', ')),
    valuesClause: sql.join(valueParams, sql.raw(', ')),
  }
}

function handleInsertError(error: unknown): ValidationError {
  if (findConstraintViolation(error) === 'not-null') {
    return new ValidationError('Validation failed: Required field is missing', [
      { record: 0, field: 'unknown', error: 'Required field is missing' },
    ])
  }
  return new ValidationError('Insert failed due to constraint violation', [])
}

export async function createSingleRecord(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Promise<Readonly<Record<string, unknown>> | undefined> {
  const clauses = buildInsertClauses(fields)
  if (!clauses) return undefined

  try {
    const result = await executeRaw(
      tx,
      sql`INSERT INTO ${sql.identifier(tableName)} (${clauses.columnsClause}) VALUES (${clauses.valuesClause}) RETURNING *`
    )

    return result[0] ?? undefined
  } catch (error) {
    throw handleInsertError(error)
  }
}

export function createSingleRecordInBatch(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Effect.Effect<Record<string, unknown> | undefined, ValidationError> {
  return Effect.tryPromise({
    try: async () => {
      const clauses = buildInsertClauses(fields)
      if (!clauses) return undefined

      const result = await executeRaw(
        tx,
        sql`INSERT INTO ${sql.identifier(tableName)} (${clauses.columnsClause}) VALUES (${clauses.valuesClause}) RETURNING *`
      )

      return result[0] ?? undefined
    },
    catch: handleInsertError,
  })
}
