/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Database session context error
 */
export class SessionContextError extends Error {
  readonly _tag = 'SessionContextError'
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'SessionContextError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.cause = cause
  }
}

/**
 * Forbidden error for authorization failures
 */
export class ForbiddenError extends Error {
  readonly _tag = 'ForbiddenError'

  constructor(message: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'ForbiddenError'
  }
}

/**
 * Database transaction interface supporting unsafe SQL execution
 */
export interface DatabaseTransaction {
  readonly unsafe: (sql: string) => Promise<unknown>
}

/**
 * SQL escape helper to prevent SQL injection
 * Escapes single quotes by doubling them (PostgreSQL standard)
 *
 * @param value - Value to escape
 * @returns Escaped value safe for SQL interpolation
 */
const escapeSQL = (value: string): string => {
  return value.replace(/'/g, "''")
}

/**
 * Get user's global role from Better Auth users table
 *
 * Queries the auth.user table for the user's global role.
 * Returns 'authenticated' if no role is set.
 *
 * @param tx - Database transaction
 * @param userId - User ID from session
 * @returns Effect resolving to global user role
 */
const getGlobalUserRole = (
  tx: DatabaseTransaction,
  userId: string
): Effect.Effect<string, SessionContextError> =>
  Effect.tryPromise({
    try: async () => {
      const rows = (await tx.unsafe(
        `SELECT role FROM "auth.user" WHERE id = '${escapeSQL(userId)}' LIMIT 1`
      )) as Array<{ role: string | null }>
      return rows[0]?.role || 'authenticated'
    },
    catch: (error) => new SessionContextError('Failed to query user role from users table', error),
  })

/**
 * Set database session context for RLS policies
 *
 * Sets PostgreSQL session variables that RLS policies depend on:
 * - app.user_id: Authenticated user ID from Better Auth
 * - app.user_role: User's global role (or 'authenticated' if no role set)
 *
 * SECURITY: These variables are LOCAL to the transaction and reset after commit.
 * They must be set before executing any queries that rely on RLS policies.
 *
 * @param tx - Database transaction
 * @param session - Better Auth session object
 * @returns Effect resolving when session context is set
 *
 * @example
 * ```typescript
 * await db.transaction(async (tx) => {
 *   await setDatabaseSessionContext(tx, session)
 *   // Queries now have access to app.user_id, app.user_role
 *   const records = await tx.select().from(tasks)
 *   return records
 * })
 * ```
 */
export const setDatabaseSessionContext = (
  tx: DatabaseTransaction,
  session: Readonly<Session>
): Effect.Effect<void, SessionContextError> =>
  Effect.gen(function* () {
    const userId = escapeSQL(session.userId)
    const role = yield* getGlobalUserRole(tx, session.userId)

    yield* Effect.tryPromise({
      try: () =>
        tx.unsafe(`
        SET LOCAL app.user_id = '${userId}';
        SET LOCAL app.user_role = '${escapeSQL(role)}';
      `),
      catch: (error) => new SessionContextError('Failed to set session context', error),
    })
  })

/**
 * Clear database session context
 *
 * Resets PostgreSQL session variables to their defaults.
 * Useful for testing to ensure clean state between tests.
 *
 * @param tx - Database transaction
 * @returns Effect resolving when session context is cleared
 *
 * @example
 * ```typescript
 * await db.transaction(async (tx) => {
 *   await clearDatabaseSessionContext(tx)
 *   // Queries now execute without user context (RLS policies will deny access)
 * })
 * ```
 */
export const clearDatabaseSessionContext = (
  tx: DatabaseTransaction
): Effect.Effect<void, SessionContextError> =>
  Effect.tryPromise({
    try: () =>
      tx.unsafe(`
      RESET app.user_id;
      RESET app.user_role;
    `),
    catch: (error) => new SessionContextError('Failed to clear session context', error),
  })

/**
 * Get current session context values (for debugging/testing)
 *
 * Retrieves the current values of session variables.
 * Returns empty strings if variables are not set.
 *
 * @param tx - Database transaction
 * @returns Effect resolving to current session context values
 *
 * @example
 * ```typescript
 * const context = await getCurrentSessionContext(tx)
 * console.log('User ID:', context.userId)
 * console.log('Role:', context.role)
 * ```
 */
export const getCurrentSessionContext = (
  tx: DatabaseTransaction
): Effect.Effect<{ userId: string; role: string }, SessionContextError> =>
  Effect.tryPromise({
    try: async () => {
      const result = (await tx.unsafe(`
        SELECT
          current_setting('app.user_id', true) as user_id,
          current_setting('app.user_role', true) as role
      `)) as Array<{ user_id: string; role: string }>

      const row = result[0]
      return {
        userId: row?.user_id || '',
        role: row?.role || '',
      }
    },
    catch: (error) => new SessionContextError('Failed to get session context', error),
  })
