/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { db } from './drizzle/db'
import type { SessionContextError } from './session-context'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Database transaction type (Drizzle transaction is compatible with db for most operations)
 */
type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0]

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
    // Execute operation within a transaction with session context
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          // Set session context at the start of the transaction
          // Use tx.execute for raw SQL (Drizzle transaction interface)
          await tx.execute(
            `SET LOCAL app.user_id = '${session.userId.replace(/'/g, "''")}';
             SET LOCAL app.organization_id = '${(session.activeOrganizationId || '').replace(/'/g, "''")}';
             SET LOCAL app.user_role = 'authenticated';`
          )

          // Execute the user's operation with the transaction
          // Note: Effect.runPromise is intentional - Drizzle's transaction callback
          // runs outside Effect runtime, requiring a new runtime for the operation
          // @effect-suppress runEffectInsideEffect
          const operationResult = await Effect.runPromise(operation(tx))
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
    // Set session context at the start of the transaction
    await tx.execute(
      `SET LOCAL app.user_id = '${session.userId.replace(/'/g, "''")}';
       SET LOCAL app.organization_id = '${(session.activeOrganizationId || '').replace(/'/g, "''")}';
       SET LOCAL app.user_role = 'authenticated';`
    )

    // Execute the user's operation with the transaction
    return await operation(tx)
  })
}
