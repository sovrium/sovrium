/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Runtime } from 'effect'
import { db } from './drizzle/db'
import type { SessionContextError } from './session-context'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Database transaction type (Drizzle transaction is compatible with db for most operations)
 */
type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Escape SQL string values to prevent SQL injection
 */
const escapeSQL = (value: string): string => value.replace(/'/g, "''")

/**
 * Get user role for session context
 *
 * Role resolution priority:
 * 1. If active organization: check members table for org-specific role
 * 2. If no active organization or no membership: check global user role from users table
 * 3. Default: 'authenticated'
 *
 * @param tx - Database transaction
 * @param session - Better Auth session
 * @returns User role string
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Database transactions inherently require mutable state for query execution
const getUserRole = async (tx: TransactionLike, session: Readonly<Session>): Promise<string> => {
  // If active organization, check members table first
  if (session.activeOrganizationId) {
    const memberResult = (await tx.execute(
      `SELECT role FROM "_sovrium_auth_members" WHERE organization_id = '${escapeSQL(session.activeOrganizationId)}' AND user_id = '${escapeSQL(session.userId)}' LIMIT 1`
    )) as Array<{ role: string | null }>

    if (memberResult[0]?.role) {
      return memberResult[0].role
    }
  }

  // Fall back to global user role from users table
  const userResult = (await tx.execute(
    `SELECT role FROM "_sovrium_auth_users" WHERE id = '${escapeSQL(session.userId)}' LIMIT 1`
  )) as Array<{ role: string | null }>

  return userResult[0]?.role || 'authenticated'
}

/**
 * Execute a database operation with automatic session context
 *
 * This function wraps database operations in a transaction and automatically sets
 * PostgreSQL session variables (app.user_id, app.organization_id, app.user_role)
 * based on the Better Auth session. This enables RLS policies to function correctly.
 *
 * @param session - Better Auth session object
 * @param operation - Database operation to execute within the session context
 * @returns Effect resolving to the operation result
 *
 * @example
 * ```typescript
 * const getTasks = (session: Session) =>
 *   withSessionContext(session, (tx) =>
 *     Effect.tryPromise(() => tx.select().from(tasks))
 *   )
 *
 * const result = await Effect.runPromise(
 *   getTasks(session).pipe(Effect.provide(DatabaseLive))
 * )
 * ```
 */
export const withSessionContext = <A, E>(
  session: Readonly<Session>,
  operation: (tx: Readonly<TransactionLike>) => Effect.Effect<A, E>
): Effect.Effect<A, E | SessionContextError> =>
  Effect.gen(function* () {
    // Extract runtime to use in async callback (avoids Effect.runPromise inside Effect)
    const runtime = yield* Effect.runtime<never>()

    // Execute operation within a transaction with session context
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          // Get user role (org-specific or global)
          const userRole = await getUserRole(tx, session)

          // Set session context at the start of the transaction
          // Use tx.execute for raw SQL (Drizzle transaction interface)
          await tx.execute(
            `SET LOCAL app.user_id = '${session.userId.replace(/'/g, "''")}';
             SET LOCAL app.organization_id = '${(session.activeOrganizationId || '').replace(/'/g, "''")}';
             SET LOCAL app.user_role = '${userRole.replace(/'/g, "''")}';`
          )

          // Execute the user's operation with the transaction using the extracted runtime
          const operationResult = await Runtime.runPromise(runtime)(operation(tx))
          return operationResult
        }),
      catch: (error) => error as E | SessionContextError,
    })

    return result
  })

/**
 * Execute a database operation with automatic session context (simplified version)
 *
 * This is a convenience function that automatically handles the Effect context.
 * Use this when you don't need fine-grained Effect control.
 *
 * @param session - Better Auth session object
 * @param operation - Async database operation to execute
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * const tasks = await withSessionContextSimple(session, async (tx) => {
 *   return await tx.select().from(tasks)
 * })
 * ```
 */
export const withSessionContextSimple = async <A>(
  session: Readonly<Session>,
  operation: (tx: Readonly<TransactionLike>) => Promise<A>
): Promise<A> => {
  return await db.transaction(async (tx) => {
    // Get user role (org-specific or global)
    const userRole = await getUserRole(tx, session)

    // Set session context at the start of the transaction
    await tx.execute(
      `SET LOCAL app.user_id = '${session.userId.replace(/'/g, "''")}';
       SET LOCAL app.organization_id = '${(session.activeOrganizationId || '').replace(/'/g, "''")}';
       SET LOCAL app.user_role = '${userRole.replace(/'/g, "''")}';`
    )

    // Execute the user's operation with the transaction
    return await operation(tx)
  })
}
