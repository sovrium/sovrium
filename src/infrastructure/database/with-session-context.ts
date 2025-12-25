/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect, Runtime } from 'effect'
import { db } from './drizzle/db'
import type { SessionContextError } from './session-context'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

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

const getUserRole = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any,
  session: Readonly<Session>
): Promise<string> => {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  operation: (tx: Readonly<any>) => Effect.Effect<A, E>
): Effect.Effect<A, E | SessionContextError> =>
  Effect.gen(function* () {
    // Extract runtime to use in async callback (avoids Effect.runPromise inside Effect)
    const runtime = yield* Effect.runtime<never>()

    // Execute operation within a transaction with session context
    const result = yield* Effect.tryPromise<A, E | SessionContextError>({
      try: () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
        db.transaction(async (tx: any) => {
          // Get user role (org-specific or global)
          const userRole = await getUserRole(tx, session)

          // CRITICAL: Execute SET LOCAL ROLE app_user FIRST (superusers bypass RLS)
          // eslint-disable-next-line functional/no-expression-statements -- Database transaction requires side effects
          await tx.execute(sql.raw(`SET LOCAL ROLE app_user`))

          // Set session context at the start of the transaction
          // Execute each SET LOCAL statement separately (Drizzle may not support multi-statement SQL)
          // SET LOCAL requires literal string values, not parameterized queries
          // Use sql.raw() with escapeSQL() for SQL injection protection
          await tx.execute(sql.raw(`SET LOCAL app.user_id = '${escapeSQL(session.userId)}'`))
          await tx.execute(
            sql.raw(
              `SET LOCAL app.organization_id = '${escapeSQL(session.activeOrganizationId || '')}'`
            )
          )
          await tx.execute(sql.raw(`SET LOCAL app.user_role = '${escapeSQL(userRole)}'`))

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  operation: (tx: Readonly<any>) => Promise<A>
): Promise<A> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  return await db.transaction(async (tx: any) => {
    // Get user role (org-specific or global)
    const userRole = await getUserRole(tx, session)

    // CRITICAL: Execute SET LOCAL ROLE app_user FIRST (superusers bypass RLS)
    // eslint-disable-next-line functional/no-expression-statements -- Database transaction requires side effects
    await tx.execute(sql.raw(`SET LOCAL ROLE app_user`))

    // Set session context at the start of the transaction
    // Execute each SET LOCAL statement separately (Drizzle may not support multi-statement SQL)
    // SET LOCAL requires literal string values, not parameterized queries
    // Use sql.raw() with escapeSQL() for SQL injection protection
    await tx.execute(sql.raw(`SET LOCAL app.user_id = '${escapeSQL(session.userId)}'`))
    await tx.execute(
      sql.raw(`SET LOCAL app.organization_id = '${escapeSQL(session.activeOrganizationId || '')}'`)
    )
    await tx.execute(sql.raw(`SET LOCAL app.user_role = '${escapeSQL(userRole)}'`))

    // Execute the user's operation with the transaction
    return await operation(tx)
  })
}
