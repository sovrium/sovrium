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
      catch: (error) => new SessionContextError(`Failed to get record ${recordId} from ${tableName}`, error),
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
      catch: (error) => new SessionContextError(`Failed to update record ${recordId} in ${tableName}`, error),
    })
  )
}

/**
 * Delete a record with session context
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
        // Delete with RLS policies applied
        // eslint-disable-next-line functional/no-expression-statements -- Database deletion requires side effect
        await tx.execute(`DELETE FROM ${tableName} WHERE id = '${recordId}'`)
        return true
      },
      catch: (error) => new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error),
    })
  )
}
