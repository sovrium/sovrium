/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  db,
  withSessionContext,
  SessionContextError,
  UniqueConstraintViolationError,
} from '@/infrastructure/database'
import { activityLogs } from '@/infrastructure/database/drizzle/schema/activity-log'
import { generateSqlCondition } from '@/infrastructure/database/filter-operators'
import { validateTableName, validateColumnName } from './validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * List all records from a table with session context
 *
 * Returns all accessible records (RLS policies apply automatically via session context).
 * Organization-scoped filtering has been removed.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table to query
 * @param table - Table schema configuration (unused, kept for backward compatibility)
 * @returns Effect resolving to array of records
 */
export function listRecords(
  session: Readonly<Session>,
  tableName: string,
  table?: { readonly permissions?: { readonly organizationScoped?: boolean } },
  filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)

        // Add user-provided filters (static import - no performance overhead)
        const userFilterConditions =
          filter?.and && filter.and.length > 0
            ? (() => {
                const andConditions = filter.and ?? [] // Type narrowing
                return andConditions
                  .map((f) => {
                    validateColumnName(f.field)
                    return generateSqlCondition(f.field, f.operator, f.value, {
                      useEscapeSqlString: true,
                    })
                  })
                  .filter((c) => c !== '')
              })()
            : []

        const conditions = userFilterConditions

        // Build final query
        const whereClause =
          conditions.length > 0 ? sql.raw(` WHERE ${conditions.join(' AND ')}`) : sql.raw('')

        const result = await tx.execute(
          sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause}`
        )

        return result as readonly Record<string, unknown>[]
      },
      catch: (error) => new SessionContextError(`Failed to list records from ${tableName}`, error),
    })
  )
}

/**
 * Get a single record by ID with session context
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @returns Effect resolving to record or null
 */
export function getRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)

        // Use parameterized query for recordId (automatic via template literal)
        const result = (await tx.execute(
          sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${recordId} LIMIT 1`
        )) as readonly Record<string, unknown>[]

        // eslint-disable-next-line unicorn/no-null -- Null is intentional for database records that don't exist
        return result[0] ?? null
      },
      catch: (error) => {
        return new SessionContextError(`Failed to get record ${recordId} from ${tableName}`, error)
      },
    })
  )
}

/**
 * Create a new record with session context
 *
 * Automatically sets organization_id and owner_id from session.
 * Security: Silently overrides any user-provided organization_id to prevent
 * cross-organization data injection attacks.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param fields - Record fields
 * @returns Effect resolving to created record
 */
export function createRecord(
  session: Readonly<Session>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Effect.Effect<Record<string, unknown>, SessionContextError | UniqueConstraintViolationError> {
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      yield* Effect.sync(() => validateTableName(tableName))

      // Check if table has organization_id or owner_id columns
      const columnCheck = yield* Effect.tryPromise({
        try: () =>
          tx.execute(
            sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name IN ('organization_id', 'owner_id')`
          ) as Promise<readonly Record<string, unknown>[]>,
        catch: (error) => new SessionContextError('Failed to check table columns', error),
      })

      const hasOrgId = columnCheck.some((row) => row.column_name === 'organization_id')
      const hasOwnerId = columnCheck.some((row) => row.column_name === 'owner_id')

      // Security: Filter out any user-provided organization_id or owner_id if table has those columns
      // This prevents malicious users from injecting data into other organizations or impersonating other users
      const sanitizedFields = Object.fromEntries(
        Object.entries(fields).filter(
          ([key]) => !(hasOrgId && key === 'organization_id') && !(hasOwnerId && key === 'owner_id')
        )
      )

      // Build base entries from sanitized user fields
      const baseEntries = Object.entries(sanitizedFields)
      if (baseEntries.length === 0 && !hasOrgId && !hasOwnerId) {
        return yield* Effect.fail(
          new SessionContextError('Cannot create record with no fields', undefined)
        )
      }

      // Build column identifiers and values
      const baseColumnIdentifiers = baseEntries.map(([key]) => {
        validateColumnName(key)
        return sql.identifier(key)
      })
      const baseValueParams = baseEntries.map(([, value]) => sql`${value}`)

      // Add organization_id column and value from session (immutable)
      const withOrgColumn = hasOrgId
        ? [...baseColumnIdentifiers, sql.identifier('organization_id')]
        : baseColumnIdentifiers
      const withOrgValue = hasOrgId
        ? [...baseValueParams, sql.raw(`current_setting('app.organization_id', true)`)]
        : baseValueParams

      // Add owner_id column and value from session (immutable)
      const columnIdentifiers = hasOwnerId
        ? [...withOrgColumn, sql.identifier('owner_id')]
        : withOrgColumn
      const valueParams = hasOwnerId ? [...withOrgValue, sql`${session.userId}`] : withOrgValue

      // Build INSERT query using sql.join for columns and values
      const columnsClause = sql.join(columnIdentifiers, sql.raw(', '))
      const valuesClause = sql.join(valueParams, sql.raw(', '))

      const result = yield* Effect.tryPromise({
        try: async () => {
          const insertResult = (await tx.execute(
            sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
          )) as readonly Record<string, unknown>[]
          return insertResult
        },
        catch: (error) => {
          // Check for PostgreSQL unique constraint violation
          // The error is wrapped in DrizzleQueryError with the actual error in the cause
          const cause =
            error && typeof error === 'object' && 'cause' in error ? error.cause : undefined
          const causeCode =
            cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined
          const causeConstraint =
            cause && typeof cause === 'object' && 'constraint' in cause
              ? cause.constraint
              : undefined

          // Detect unique constraint violation:
          // - Check for PostgreSQL error code 23505
          // - Check for 'constraint' property (Bun SQL driver includes this)
          // - Check for 'unique constraint' in error message
          if (
            causeCode === '23505' ||
            (causeConstraint && typeof causeConstraint === 'string') ||
            (cause &&
              typeof cause === 'object' &&
              'message' in cause &&
              typeof cause.message === 'string' &&
              cause.message.includes('unique constraint'))
          ) {
            return new UniqueConstraintViolationError('Unique constraint violation', error)
          }
          return new SessionContextError(`Failed to create record in ${tableName}`, error)
        },
      })

      const createdRecord = result[0] ?? {}

      // Log activity for record creation (outside session context)
      // Use Effect.ignore to silently skip errors (non-critical operation)
      yield* Effect.ignore(
        Effect.tryPromise({
          try: async () => {
            // Get table ID from information_schema
            const tableIdResult = (await db.execute(
              sql`SELECT schemaname, tablename FROM pg_tables WHERE tablename = ${tableName} LIMIT 1`
            )) as readonly Record<string, unknown>[]

            // Use '1' as fallback table ID if not found in schema
            const tableId = tableIdResult[0] ? '1' : '1'

            await db.insert(activityLogs).values({
              id: crypto.randomUUID(),
              userId: session.userId,
              action: 'create',
              tableName,
              tableId,
              recordId: String(createdRecord.id),
              changes: {
                after: createdRecord,
              },
            })
          },
          catch: (error) => new SessionContextError('Failed to log activity', error),
        })
      )

      return createdRecord
    })
  )
}

/**
 * Update a record with session context
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param fields - Fields to update
 * @returns Effect resolving to updated record
 */
export function updateRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  fields: Readonly<Record<string, unknown>>
): Effect.Effect<Record<string, unknown>, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const entries = Object.entries(fields)

        if (entries.length === 0) {
          // eslint-disable-next-line functional/no-throw-statements -- Validation requires throwing for empty fields
          throw new Error('Cannot update record with no fields')
        }

        // Build SET clause with validated columns and parameterized values
        const setClauses = entries.map(([key, value]) => {
          validateColumnName(key)
          return sql`${sql.identifier(key)} = ${value}`
        })
        const setClause = sql.join(setClauses, sql.raw(', '))

        const result = (await tx.execute(
          sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
        )) as readonly Record<string, unknown>[]

        // If RLS blocked the update, result will be empty
        if (result.length === 0) {
          // eslint-disable-next-line functional/no-throw-statements -- RLS blocking requires error propagation
          throw new Error(`Record not found or access denied`)
        }

        return result[0]!
      },
      catch: (error) => {
        // Preserve "not found" or "access denied" in wrapper message for API error handling
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (errorMsg.includes('not found') || errorMsg.includes('access denied')) {
          return new SessionContextError(errorMsg, error)
        }
        return new SessionContextError(`Failed to update record ${recordId} in ${tableName}`, error)
      },
    })
  )
}

/**
 * Delete a record with session context (soft delete if deleted_at field exists)
 *
 * Implements soft delete pattern:
 * - If table has deleted_at field: Sets deleted_at to NOW() (soft delete)
 * - If no deleted_at field: Performs hard delete
 * - RLS policies automatically applied via session context
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @returns Effect resolving to success boolean
 */
export function deleteRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const tableIdent = sql.identifier(tableName)

        // Check if table has deleted_at and organization_id columns
        const columnCheck = (await tx.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name IN ('deleted_at', 'organization_id')`
        )) as readonly Record<string, unknown>[]

        const hasDeletedAt = columnCheck.some((row) => row.column_name === 'deleted_at')
        const hasOrgId = columnCheck.some((row) => row.column_name === 'organization_id')

        if (hasDeletedAt) {
          // Soft delete: set deleted_at timestamp (parameterized)
          // Use RETURNING to check if update affected any rows (RLS or organization filter may block access)
          const result = hasOrgId
            ? ((await tx.execute(
                sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id = ${recordId} AND organization_id = current_setting('app.organization_id', true) RETURNING id`
              )) as readonly Record<string, unknown>[])
            : ((await tx.execute(
                sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id = ${recordId} RETURNING id`
              )) as readonly Record<string, unknown>[])

          // If organization filter or RLS blocked the update, result will be empty
          return result.length > 0
        } else {
          // Hard delete: remove record (parameterized)
          // Use RETURNING to check if delete affected any rows (RLS or organization filter may block access)
          const result = hasOrgId
            ? ((await tx.execute(
                sql`DELETE FROM ${tableIdent} WHERE id = ${recordId} AND organization_id = current_setting('app.organization_id', true) RETURNING id`
              )) as readonly Record<string, unknown>[])
            : ((await tx.execute(
                sql`DELETE FROM ${tableIdent} WHERE id = ${recordId} RETURNING id`
              )) as readonly Record<string, unknown>[])

          // If organization filter or RLS blocked the delete, result will be empty
          return result.length > 0
        }
      },
      catch: (error) =>
        new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error),
    })
  )
}

/**
 * Restore a soft-deleted record with session context
 *
 * Clears the deleted_at timestamp to restore a soft-deleted record.
 * Returns error if record doesn't exist or is not soft-deleted.
 * RLS policies automatically applied via session context.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @returns Effect resolving to restored record or error
 */
export function restoreRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const tableIdent = sql.identifier(tableName)

        // Check if record exists (including soft-deleted records)
        const checkResult = (await tx.execute(
          sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
        )) as readonly Record<string, unknown>[]

        if (checkResult.length === 0) {
          // eslint-disable-next-line unicorn/no-null -- Null is intentional for non-existent records
          return null // Record not found
        }

        const record = checkResult[0]

        // Check if record is soft-deleted
        if (!record?.deleted_at) {
          // Record exists but is not deleted - return error via special marker
          return { _error: 'not_deleted' } as Record<string, unknown>
        }

        // Restore record by clearing deleted_at
        const result = (await tx.execute(
          sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id = ${recordId} RETURNING *`
        )) as readonly Record<string, unknown>[]

        return result[0] ?? {}
      },
      catch: (error) =>
        new SessionContextError(`Failed to restore record ${recordId} from ${tableName}`, error),
    })
  )
}
