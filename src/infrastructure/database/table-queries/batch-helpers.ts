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
    // 23505 = unique_violation

    // Extract the underlying PostgreSQL error from DrizzleQueryError wrapper
    const cause = (error as any)?.cause
    const pgError = cause ?? error
    const errorCode = pgError.errno ?? pgError.code
    const errorMessage = pgError.message ?? (error as Error)?.message ?? ''

    // Handle NOT NULL constraint violations
    if (errorCode === '23502' || errorMessage.includes('null value in column')) {
      // Extract field name from error message or detail
      let fieldName = 'unknown'
      const columnMatch = errorMessage.match(/column "([^"]+)"/)
      if (columnMatch) {
        fieldName = columnMatch[1]
      }
      // eslint-disable-next-line functional/no-throw-statements -- Required for error propagation
      throw new ValidationError(`Validation failed: Field '${fieldName}' is required`, [
        { record: 0, field: fieldName, error: `Field '${fieldName}' is required` },
      ])
    }

    // Handle unique constraint violations
    if (errorCode === '23505' || errorMessage.includes('duplicate key value')) {
      // Extract field name from error message
      let fieldName = 'unknown'
      const columnMatch = errorMessage.match(/column "([^"]+)"/)
      if (columnMatch) {
        fieldName = columnMatch[1]
      }
      // eslint-disable-next-line functional/no-throw-statements -- Required for error propagation
      throw new ValidationError(`Validation failed: Duplicate value for field '${fieldName}'`, [
        { record: 0, field: fieldName, error: `Value must be unique` },
      ])
    }

    // Re-throw other errors
    // eslint-disable-next-line functional/no-throw-statements -- Required for error propagation
    throw error
  }
}
