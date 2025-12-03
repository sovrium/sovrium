/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import type { Session, Member } from '@/infrastructure/auth/better-auth/schema'

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
 * Get user role in active organization from Better Auth members table
 *
 * If session has an active organization, queries the members table to get the user's role.
 * If no active organization, returns 'authenticated' as default role.
 *
 * @param tx - Database transaction
 * @param session - Better Auth session
 * @returns Effect resolving to user role
 */
const getUserRoleInOrganization = (
  tx: DatabaseTransaction,
  session: Readonly<Session>
): Effect.Effect<string, SessionContextError> =>
  Effect.gen(function* () {
    // If no active organization, return default authenticated role
    if (!session.activeOrganizationId) {
      return 'authenticated'
    }

    // Query members table for user role in organization
    const result = yield* Effect.tryPromise({
      try: async () => {
        const rows = (await tx.unsafe(
          `SELECT role FROM members WHERE organization_id = '${escapeSQL(session.activeOrganizationId || '')}' AND user_id = '${escapeSQL(session.userId)}' LIMIT 1`
        )) as Member[]
        return rows
      },
      catch: (error) =>
        new SessionContextError('Failed to query user role from members table', error),
    })

    // If no membership found, return default authenticated role
    if (!result || result.length === 0) {
      return 'authenticated'
    }

    const role = result[0]?.role
    return role || 'authenticated'
  })

/**
 * Set database session context for RLS policies
 *
 * Sets PostgreSQL session variables that RLS policies depend on:
 * - app.user_id: Authenticated user ID from Better Auth
 * - app.organization_id: Active organization ID from session (or empty string)
 * - app.user_role: User role in active organization (or 'authenticated' if no org)
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
 *   // Queries now have access to app.user_id, app.organization_id, app.user_role
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
    const orgId = escapeSQL(session.activeOrganizationId || '')
    const role = yield* getUserRoleInOrganization(tx, session)

    yield* Effect.tryPromise({
      try: () =>
        tx.unsafe(`
        SET LOCAL app.user_id = '${userId}';
        SET LOCAL app.organization_id = '${orgId}';
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
      RESET app.organization_id;
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
 * console.log('Organization ID:', context.organizationId)
 * console.log('Role:', context.role)
 * ```
 */
export const getCurrentSessionContext = (
  tx: DatabaseTransaction
): Effect.Effect<{ userId: string; organizationId: string; role: string }, SessionContextError> =>
  Effect.tryPromise({
    try: async () => {
      const result = (await tx.unsafe(`
        SELECT
          current_setting('app.user_id', true) as user_id,
          current_setting('app.organization_id', true) as organization_id,
          current_setting('app.user_role', true) as role
      `)) as Array<{ user_id: string; organization_id: string; role: string }>

      const row = result[0]
      return {
        userId: row?.user_id || '',
        organizationId: row?.organization_id || '',
        role: row?.role || '',
      }
    },
    catch: (error) => new SessionContextError('Failed to get session context', error),
  })
