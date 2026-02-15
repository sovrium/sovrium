/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Data, Effect, Exit, Cause } from 'effect'
import { ValidationError, type DrizzleTransaction } from '@/infrastructure/database'
import { validateColumnName } from './validation'

/**
 * Batch validation error - returned when batch validation fails
 */
export class BatchValidationError extends Data.TaggedError('BatchValidationError')<{
  readonly message: string
  readonly details?: readonly string[]
}> {}

/**
 * Run an Effect inside a database transaction, properly unwrapping errors.
 *
 * Unlike Effect.runPromise which wraps errors in FiberFailure (breaking instanceof checks
 * in outer catch handlers), this helper extracts the original error via Cause.squash
 * and re-throws it directly. This ensures SessionContextError, ValidationError, etc.
 * are properly detected by instanceof in Effect.tryPromise catch handlers.
 */
export async function runEffectInTx<A, E>(effect: Effect.Effect<A, E, never>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect)
  if (Exit.isSuccess(exit)) return exit.value
  // eslint-disable-next-line functional/no-throw-statements -- Required to propagate Effect errors in async transaction context
  throw Cause.squash(exit.cause)
}

/**
 * Helper to create a single record within a transaction
 */
export async function createSingleRecord(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Promise<Readonly<Record<string, unknown>> | undefined> {
  // Build entries from user fields
  const entries = Object.entries(fields)
  if (entries.length === 0) return undefined

  // Build column identifiers and values
  const columnIdentifiers = entries.map(([key]) => {
    validateColumnName(key)
    return sql.identifier(key)
  })
  const valueParams = entries.map(([, value]) => sql`${value}`)

  const columnsClause = sql.join(columnIdentifiers, sql.raw(', '))
  const valuesClause = sql.join(valueParams, sql.raw(', '))

  try {
    const result = (await tx.execute(
      sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
    )) as readonly Record<string, unknown>[]

    return result[0] ?? undefined
  } catch (error) {
    // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
    // 23502 = not_null_violation
    const pgError = error as { code?: string; message?: string }
    if (pgError.code === '23502' || pgError.message?.includes('null value in column')) {
      // eslint-disable-next-line functional/no-throw-statements -- Required for error propagation
      throw new ValidationError('Validation failed: Required field is missing', [
        { record: 0, field: 'unknown', error: 'Required field is missing' },
      ])
    }
    // eslint-disable-next-line functional/no-throw-statements -- Required for error propagation
    throw error
  }
}

/**
 * Effect-based helper to create a single record within a batch operation
 *
 * This is the Effect version of createSingleRecord, used by batchCreateRecords
 * to properly propagate ValidationError through Effect.reduce.
 */
export function createSingleRecordInBatch(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Effect.Effect<Record<string, unknown> | undefined, ValidationError> {
  return Effect.tryPromise({
    try: async () => {
      // Build entries from user fields
      const entries = Object.entries(fields)
      if (entries.length === 0) return undefined

      // Build column identifiers and values
      const columnIdentifiers = entries.map(([key]) => {
        validateColumnName(key)
        return sql.identifier(key)
      })
      const valueParams = entries.map(([, value]) => sql`${value}`)

      const columnsClause = sql.join(columnIdentifiers, sql.raw(', '))
      const valuesClause = sql.join(valueParams, sql.raw(', '))

      const result = (await tx.execute(
        sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
      )) as readonly Record<string, unknown>[]

      return result[0] ?? undefined
    },
    catch: (error) => {
      // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
      // 23502 = not_null_violation
      const pgError = error as { code?: string; message?: string }
      if (pgError.code === '23502' || pgError.message?.includes('null value in column')) {
        return new ValidationError('Validation failed: Required field is missing', [
          { record: 0, field: 'unknown', error: 'Required field is missing' },
        ])
      }
      // For other errors, return generic validation error
      const errorMessage: string =
        pgError.message !== undefined
          ? pgError.message
          : 'Insert failed due to constraint violation'
      return new ValidationError(errorMessage, [])
    },
  })
}
