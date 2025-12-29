/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { withSessionContext, SessionContextError, ForbiddenError } from '@/infrastructure/database'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Validate a table name to prevent SQL injection
 *
 * PostgreSQL identifiers cannot be fully parameterized, so we validate them.
 * This function ensures table names:
 * - Only contain alphanumeric characters, underscores
 * - Start with a letter or underscore
 * - Are within PostgreSQL's 63-character limit
 *
 * @param tableName - Raw table name from user input
 * @throws Error if table name contains invalid characters
 */
const validateTableName = (tableName: string): void => {
  // PostgreSQL identifier rules: start with letter/underscore, contain alphanumeric/underscore
  // Max 63 characters (PostgreSQL limit)
  const validIdentifier = /^[a-z_][a-z0-9_]*$/i
  if (!validIdentifier.test(tableName) || tableName.length > 63) {
    // eslint-disable-next-line functional/no-throw-statements -- Validation requires throwing for invalid input
    throw new Error(`Invalid table name: ${tableName}`)
  }
}

/**
 * Validate a column name to prevent SQL injection
 */
const validateColumnName = (columnName: string): void => {
  const validIdentifier = /^[a-z_][a-z0-9_]*$/i
  if (!validIdentifier.test(columnName) || columnName.length > 63) {
    // eslint-disable-next-line functional/no-throw-statements -- Validation requires throwing for invalid input
    throw new Error(`Invalid column name: ${columnName}`)
  }
}

/**
 * List all records from a table with session context
 *
 * Automatically applies RLS policies based on session variables.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table to query
 * @returns Effect resolving to array of records
 */
export function listRecords(
  session: Readonly<Session>,
  tableName: string
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        // Query table using sql.identifier for safe identifier handling
        // RLS policies automatically applied via session context
        const result = await tx.execute(sql`SELECT * FROM ${sql.identifier(tableName)}`)
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
): Effect.Effect<Record<string, unknown>, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const entries = Object.entries(fields)

        if (entries.length === 0) {
          // eslint-disable-next-line functional/no-throw-statements -- Validation requires throwing for empty fields
          throw new Error('Cannot create record with no fields')
        }

        // Validate and build column identifiers
        const columnIdentifiers = entries.map(([key]) => {
          validateColumnName(key)
          return sql.identifier(key)
        })

        // Build parameterized values
        const valueParams = entries.map(([, value]) => value)

        // Build INSERT query using sql.join for columns and values
        const columnsClause = sql.join(columnIdentifiers, sql.raw(', '))
        const valuesClause = sql.join(
          valueParams.map((v) => sql`${v}`),
          sql.raw(', ')
        )

        const result = (await tx.execute(
          sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
        )) as readonly Record<string, unknown>[]

        return result[0] ?? {}
      },
      catch: (error) => {
        // Debug: Log actual PostgreSQL error
        console.error('[createRecord] PostgreSQL error:', error)
        if (error && typeof error === 'object' && 'message' in error) {
          console.error('[createRecord] Error message:', error.message)
        }
        // Include the actual error message in the SessionContextError message for debugging
        const errorMessage =
          error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : String(error)
        return new SessionContextError(
          `Failed to create record in ${tableName}: ${errorMessage}`,
          error
        )
      },
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

        // Check if table has deleted_at column for soft delete
        const columnCheck = (await tx.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
        )) as readonly Record<string, unknown>[]

        if (columnCheck.length > 0) {
          // Soft delete: set deleted_at timestamp (parameterized)
          // Use RETURNING to check if update affected any rows (RLS may block access)
          const result = (await tx.execute(
            sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id = ${recordId} RETURNING id`
          )) as readonly Record<string, unknown>[]

          // If RLS blocked the update, result will be empty
          return result.length > 0
        } else {
          // Hard delete: remove record (parameterized)
          // Use RETURNING to check if delete affected any rows (RLS may block access)
          const result = (await tx.execute(
            sql`DELETE FROM ${tableIdent} WHERE id = ${recordId} RETURNING id`
          )) as readonly Record<string, unknown>[]

          // If RLS blocked the delete, result will be empty
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

        // Check if table has organization_id column for multi-tenancy
        const columnCheck = (await tx.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'organization_id'`
        )) as readonly Record<string, unknown>[]

        const hasOrgId = columnCheck.length > 0

        // Build query with optional organization filter
        // Note: org filter uses escaped value since it's part of dynamic SQL construction
        const orgIdCondition =
          hasOrgId && session.activeOrganizationId
            ? sql` AND organization_id = ${session.activeOrganizationId}`
            : sql``

        // Check if record exists (including soft-deleted records) with organization filtering
        const checkResult = (await tx.execute(
          sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId}${orgIdCondition} LIMIT 1`
        )) as readonly Record<string, unknown>[]

        if (checkResult.length === 0) {
          // eslint-disable-next-line unicorn/no-null -- Null is intentional for non-existent records
          return null // Record not found (or wrong organization)
        }

        const record = checkResult[0]

        // Check if record is soft-deleted
        if (!record?.deleted_at) {
          // Record exists but is not deleted - return error via special marker
          return { _error: 'not_deleted' } as Record<string, unknown>
        }

        // Restore record by clearing deleted_at (with organization filter for safety)
        const result = (await tx.execute(
          sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id = ${recordId}${orgIdCondition} RETURNING *`
        )) as readonly Record<string, unknown>[]

        return result[0] ?? {}
      },
      catch: (error) =>
        new SessionContextError(`Failed to restore record ${recordId} from ${tableName}`, error),
    })
  )
}

/**
 * Batch restore soft-deleted records with session context
 *
 * Restores multiple soft-deleted records in a transaction.
 * Validates all records exist and are soft-deleted before restoring any.
 * Rolls back if any record fails validation.
 * RLS policies automatically applied via session context.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordIds - Array of record IDs to restore
 * @returns Effect resolving to number of restored records or error
 */
// eslint-disable-next-line max-lines-per-function -- Batch validation requires multiple steps
export function batchRestoreRecords(
  session: Readonly<Session>,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<number, SessionContextError | ForbiddenError> {
  // eslint-disable-next-line max-lines-per-function -- Batch validation with role checks requires multiple steps
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const tableIdent = sql.identifier(tableName)

        // Check user role from session context
        const roleResult = (await tx.execute(
          sql`SELECT current_setting('app.user_role', true) as role`
        )) as Array<{ role: string | null }>

        const userRole = roleResult[0]?.role
        if (userRole === 'viewer') {
          // eslint-disable-next-line functional/no-throw-statements -- Required for Effect.tryPromise error handling
          throw new ForbiddenError('You do not have permission to restore records in this table')
        }

        // Check if table has organization_id column for multi-tenancy
        const columnCheck = (await tx.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'organization_id'`
        )) as readonly Record<string, unknown>[]

        const hasOrgId = columnCheck.length > 0
        const orgIdCondition =
          hasOrgId && session.activeOrganizationId
            ? sql` AND organization_id = ${session.activeOrganizationId}`
            : sql``

        // Validate all records exist and are soft-deleted BEFORE restoring any
        const validationResults = await Promise.all(
          recordIds.map(async (recordId) => {
            const checkResult = (await tx.execute(
              sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId}${orgIdCondition} LIMIT 1`
            )) as readonly Record<string, unknown>[]

            if (checkResult.length === 0) {
              return { recordId, error: 'not found' }
            }

            const record = checkResult[0]
            if (!record?.deleted_at) {
              return { recordId, error: 'not deleted' }
            }

            return { recordId, error: undefined }
          })
        )

        // Check for validation errors
        const firstError = validationResults.find((result) => result.error !== undefined)
        if (firstError) {
          // eslint-disable-next-line functional/no-throw-statements -- Required for Effect.tryPromise error handling
          throw new Error(
            firstError.error === 'not found'
              ? `Record ${firstError.recordId} not found`
              : `Record ${firstError.recordId} is not deleted`
          )
        }

        // All records validated - restore them all using parameterized IN clause
        const idParams = sql.join(
          recordIds.map((id) => sql`${id}`),
          sql.raw(', ')
        )
        const result = (await tx.execute(
          sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id IN (${idParams})${orgIdCondition} RETURNING id`
        )) as readonly Record<string, unknown>[]

        return result.length
      },
      catch: (error) => {
        // Re-throw ForbiddenError unchanged (authorization failure)
        // Use name check to handle multiple import paths resolving to different class instances
        if (error instanceof Error && error.name === 'ForbiddenError') {
          return new ForbiddenError(error.message)
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return new SessionContextError(
          `Failed to batch restore records in ${tableName}: ${errorMessage}`,
          error
        )
      },
    })
  )
}

/**
 * Batch update records with session context
 *
 * Updates multiple records in a transaction with RLS policy enforcement.
 * Only records the user has permission to update will be affected.
 * Records without permission are silently skipped (RLS behavior).
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param updates - Array of records with id and fields to update
 * @returns Effect resolving to array of updated records
 */
export function batchUpdateRecords(
  session: Readonly<Session>,
  tableName: string,
  updates: readonly { readonly id: string; readonly [key: string]: unknown }[]
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)

        // Update each record individually with RLS enforcement
        const updatedRecords = await Promise.all(
          updates.map(async (update) => {
            const { id, ...fields } = update
            const entries = Object.entries(fields)

            if (entries.length === 0) {
              // eslint-disable-next-line unicorn/no-null -- Null for skipped records
              return null
            }

            // Build SET clause with validated columns and parameterized values
            const setClauses = entries.map(([key, value]) => {
              validateColumnName(key)
              return sql`${sql.identifier(key)} = ${value}`
            })
            const setClause = sql.join(setClauses, sql.raw(', '))

            try {
              const result = (await tx.execute(
                sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${id} RETURNING *`
              )) as readonly Record<string, unknown>[]

              // If RLS blocked the update, result will be empty - skip this record
              // eslint-disable-next-line unicorn/no-null -- Null for records blocked by RLS
              return result[0] ?? null
            } catch {
              // If update fails (e.g., RLS policy), skip this record
              // eslint-disable-next-line unicorn/no-null -- Null for failed updates
              return null
            }
          })
        )

        // Filter out null values (records blocked by RLS or failed updates)
        return updatedRecords.filter((record): record is Record<string, unknown> => record !== null)
      },
      catch: (error) =>
        new SessionContextError(`Failed to batch update records in ${tableName}`, error),
    })
  )
}

/**
 * Batch delete records with session context
 *
 * Deletes multiple records (soft or hard delete based on deleted_at field).
 * Organization isolation automatically enforced via RLS policies.
 * Only records in the user's organization will be deleted.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordIds - Array of record IDs to delete
 * @returns Effect resolving to number of deleted records
 */
export function batchDeleteRecords(
  session: Readonly<Session>,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<number, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const tableIdent = sql.identifier(tableName)

        // Check if table has deleted_at column for soft delete
        const columnCheck = (await tx.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
        )) as readonly Record<string, unknown>[]

        // Build parameterized IN clause
        const idParams = sql.join(
          recordIds.map((id) => sql`${id}`),
          sql.raw(', ')
        )

        if (columnCheck.length > 0) {
          // Soft delete: set deleted_at timestamp
          // RLS policies automatically filter to user's organization
          const result = (await tx.execute(
            sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id IN (${idParams}) RETURNING id`
          )) as readonly Record<string, unknown>[]

          return result.length
        } else {
          // Hard delete: remove records
          // RLS policies automatically filter to user's organization
          const result = (await tx.execute(
            sql`DELETE FROM ${tableIdent} WHERE id IN (${idParams}) RETURNING id`
          )) as readonly Record<string, unknown>[]

          return result.length
        }
      },
      catch: (error) =>
        new SessionContextError(`Failed to batch delete records in ${tableName}`, error),
    })
  )
}
