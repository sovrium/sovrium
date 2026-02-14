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
 * Inject authorship metadata fields (created_by, updated_by) into record fields
 */
async function injectAuthorshipFields(
  fields: Readonly<Record<string, unknown>>,
  userId: string,
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<Record<string, unknown>> {
  // Query table schema to check for authorship columns
  const schemaQuery = await tx.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name IN ('created_by', 'updated_by')`
  )
  const columnNames = new Set(
    (schemaQuery as unknown as readonly { column_name: string }[]).map((row) => row.column_name)
  )

  const hasCreatedBy = columnNames.has('created_by')
  const hasUpdatedBy = columnNames.has('updated_by')

  // Build new fields object with authorship metadata (immutable approach)
  // When userId is 'guest' (no auth configured), set authorship fields to NULL
  // eslint-disable-next-line unicorn/no-null -- NULL is intentional for database columns when no auth configured
  const authorUserId = userId === 'guest' ? null : userId
  return {
    ...fields,
    ...(hasCreatedBy ? { created_by: authorUserId } : {}),
    ...(hasUpdatedBy ? { updated_by: authorUserId } : {}),
  }
}

/**
 * Helper to create a single record within a transaction
 */
export async function createSingleRecord(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>,
  userId?: string
): Promise<Readonly<Record<string, unknown>> | undefined> {
  // Inject authorship metadata if userId provided
  const fieldsWithAuthorship = userId
    ? await injectAuthorshipFields(fields, userId, tx, tableName)
    : fields

  // Build entries from fields
  const entries = Object.entries(fieldsWithAuthorship)
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
