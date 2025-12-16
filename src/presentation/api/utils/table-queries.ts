/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { withSessionContext, SessionContextError } from '@/infrastructure/database'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

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
        // Query table using raw SQL (RLS policies automatically applied via session context)
        const result = await tx.execute(`SELECT * FROM ${tableName}`)
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
        // Query with RLS policies applied
        const result = (await tx.execute(
          `SELECT * FROM ${tableName} WHERE id = '${recordId}' LIMIT 1`
        )) as readonly Record<string, unknown>[]

        // eslint-disable-next-line unicorn/no-null -- Null is intentional for database records that don't exist
        return result[0] ?? null
      },
      catch: (error) =>
        new SessionContextError(`Failed to get record ${recordId} from ${tableName}`, error),
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
        // Build column names and values
        const columns = Object.keys(fields).join(', ')
        const values = Object.values(fields)
          .map((v) => (typeof v === 'string' ? `'${v}'` : v))
          .join(', ')

        // Insert with RLS policies applied
        const result = (await tx.execute(
          `INSERT INTO ${tableName} (${columns}) VALUES (${values}) RETURNING *`
        )) as readonly Record<string, unknown>[]

        return result[0] ?? {}
      },
      catch: (error) => new SessionContextError(`Failed to create record in ${tableName}`, error),
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
        // Build SET clause
        const setClauses = Object.entries(fields)
          .map(([key, value]) => `${key} = ${typeof value === 'string' ? `'${value}'` : value}`)
          .join(', ')

        // Update with RLS policies applied
        const result = (await tx.execute(
          `UPDATE ${tableName} SET ${setClauses} WHERE id = '${recordId}' RETURNING *`
        )) as readonly Record<string, unknown>[]

        return result[0] ?? {}
      },
      catch: (error) =>
        new SessionContextError(`Failed to update record ${recordId} in ${tableName}`, error),
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
        // Check if record exists before attempting delete
        const checkResult = (await tx.execute(
          `SELECT id FROM ${tableName} WHERE id = '${recordId}' LIMIT 1`
        )) as readonly Record<string, unknown>[]

        if (checkResult.length === 0) {
          return false // Record not found
        }

        // Check if table has deleted_at column for soft delete
        const columnCheck = (await tx.execute(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${tableName}' AND column_name = 'deleted_at'
        `)) as readonly Record<string, unknown>[]

        if (columnCheck.length > 0) {
          // Soft delete: set deleted_at timestamp
          // eslint-disable-next-line functional/no-expression-statements -- Database update requires side effect
          await tx.execute(`UPDATE ${tableName} SET deleted_at = NOW() WHERE id = '${recordId}'`)
        } else {
          // Hard delete: remove record
          // eslint-disable-next-line functional/no-expression-statements -- Database deletion requires side effect
          await tx.execute(`DELETE FROM ${tableName} WHERE id = '${recordId}'`)
        }

        return true
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
        // Check if record exists (including soft-deleted records)
        const checkResult = (await tx.execute(
          `SELECT id, deleted_at FROM ${tableName} WHERE id = '${recordId}' LIMIT 1`
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
          `UPDATE ${tableName} SET deleted_at = NULL WHERE id = '${recordId}' RETURNING *`
        )) as readonly Record<string, unknown>[]

        return result[0] ?? {}
      },
      catch: (error) =>
        new SessionContextError(`Failed to restore record ${recordId} from ${tableName}`, error),
    })
  )
}
