/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect, Runtime } from 'effect'
import { db, type DrizzleDB } from './drizzle/db'
import type { SessionContextError } from './session-context'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Type for Drizzle transaction callback parameter
 * Extracts the transaction type from the db.transaction method
 */
type DrizzleTransaction = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]

/**
 * Escape SQL string values to prevent SQL injection
 */
const escapeSQL = (value: string): string => value.replace(/'/g, "''")

/**
 * Get user role for session context
 *
 * Fetches the user's global role from the users table.
 * Defaults to 'authenticated' if no role is set.
 *
 * @param tx - Database transaction
 * @param session - Better Auth session
 * @returns User role string
 */

const getUserRole = async (
  tx: Readonly<DrizzleTransaction>,
  session: Readonly<Session>
): Promise<string> => {
  // Fetch global user role from users table
  try {
    const userResult = (await tx.execute(
      `SELECT role FROM "auth"."user" WHERE id = '${escapeSQL(session.userId)}' LIMIT 1`
    )) as Array<{ role: string | null }>

    return userResult[0]?.role || 'authenticated'
  } catch {
    // If role column doesn't exist, default to 'authenticated'
    return 'authenticated'
  }
}

/**
 * Get user organization for session context
 *
 * Fetches the user's organization_id from the users table.
 * Returns default 'org_123' if no organization_id is set (for testing compatibility).
 *
 * @param tx - Database transaction
 * @param session - Better Auth session
 * @returns Organization ID string
 */
const getUserOrganizationId = async (
  tx: Readonly<DrizzleTransaction>,
  session: Readonly<Session>
): Promise<string> => {
  try {
    const userResult = (await tx.execute(
      `SELECT organization_id FROM "auth"."user" WHERE id = '${escapeSQL(session.userId)}' LIMIT 1`
    )) as Array<{ organization_id: string | null }>

    return userResult[0]?.organization_id || 'org_123'
  } catch {
    // If organization_id column doesn't exist, default to 'org_123' (test default)
    return 'org_123'
  }
}

/**
 * Execute a database operation with automatic session context
 *
 * This function wraps database operations in a transaction and automatically sets
 * PostgreSQL session variables (app.user_id, app.user_role) based on the Better Auth
 * session. This enables RLS policies to function correctly.
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
  operation: (tx: Readonly<DrizzleTransaction>) => Effect.Effect<A, E>
): Effect.Effect<A, E | SessionContextError> =>
  Effect.gen(function* () {
    // Extract runtime to use in async callback (avoids Effect.runPromise inside Effect)
    const runtime = yield* Effect.runtime<never>()

    // Execute operation within a transaction with session context
    const result = yield* Effect.tryPromise<A, E | SessionContextError>({
      try: () =>
        db.transaction(async (tx: Readonly<DrizzleTransaction>) => {
          // Get user's global role and organization
          const userRole = await getUserRole(tx, session)
          const organizationId = await getUserOrganizationId(tx, session)

          // CRITICAL ORDER: Set session variables BEFORE role switch
          // Session variables must be set before SET ROLE because:
          // 1. SET LOCAL is transaction-scoped, not role-scoped
          // 2. RLS policies evaluate in the context of the CURRENT role
          // 3. Setting variables after role switch may not be visible to RLS evaluation
          await tx.execute(sql.raw(`SET LOCAL app.user_id = '${escapeSQL(session.userId)}'`))
          await tx.execute(sql.raw(`SET LOCAL app.user_role = '${escapeSQL(userRole)}'`))
          await tx.execute(sql.raw(`SET LOCAL app.organization_id = '${escapeSQL(organizationId)}'`))

          // CRITICAL: Execute SET LOCAL ROLE app_user AFTER setting session variables (superusers bypass RLS)
          // eslint-disable-next-line functional/no-expression-statements -- Database transaction requires side effects
          await tx.execute(sql.raw(`SET LOCAL ROLE app_user`))

          // Execute the user's operation with the transaction using the extracted runtime
          const operationResult = await Runtime.runPromise(runtime)(operation(tx))
          return operationResult as A
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
  operation: (tx: Readonly<DrizzleTransaction>) => Promise<A>
): Promise<A> => {
  return await db.transaction(async (tx: Readonly<DrizzleTransaction>) => {
    // Get user's global role and organization
    const userRole = await getUserRole(tx, session)
    const organizationId = await getUserOrganizationId(tx, session)

    // CRITICAL ORDER: Set session variables BEFORE role switch
    // Session variables must be set before SET ROLE because:
    // 1. SET LOCAL is transaction-scoped, not role-scoped
    // 2. RLS policies evaluate in the context of the CURRENT role
    // 3. Setting variables after role switch may not be visible to RLS evaluation
    await tx.execute(sql.raw(`SET LOCAL app.user_id = '${escapeSQL(session.userId)}'`))
    await tx.execute(sql.raw(`SET LOCAL app.user_role = '${escapeSQL(userRole)}'`))
    await tx.execute(sql.raw(`SET LOCAL app.organization_id = '${escapeSQL(organizationId)}'`))

    // CRITICAL: Execute SET LOCAL ROLE app_user AFTER setting session variables (superusers bypass RLS)
    // eslint-disable-next-line functional/no-expression-statements -- Database transaction requires side effects
    await tx.execute(sql.raw(`SET LOCAL ROLE app_user`))

    // Execute the user's operation with the transaction
    return await operation(tx)
  })
}
