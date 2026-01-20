/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Context, Data, Effect, Layer } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'

/**
 * Database error for user role operations
 */
export class UserRoleDatabaseError extends Data.TaggedError('UserRoleDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * User Role Service
 *
 * Provides type-safe database operations for user roles using Drizzle ORM.
 * Follows Sovrium patterns:
 * - Effect.ts for functional programming
 * - Drizzle ORM query builder (NO raw SQL)
 * - Context/Layer for dependency injection
 */
export class UserRoleService extends Context.Tag('UserRoleService')<
  UserRoleService,
  {
    readonly getUserRole: (
      userId: string
    ) => Effect.Effect<string | undefined, UserRoleDatabaseError>
  }
>() {}

/**
 * User Role Service Implementation
 *
 * Uses Drizzle ORM query builder for type-safe, SQL-injection-proof queries.
 */
export const UserRoleServiceLive = Layer.succeed(UserRoleService, {
  /**
   * Get user's global role from users table
   *
   * @param userId - User ID to look up
   * @returns Effect resolving to user role or undefined if not found
   */
  getUserRole: (userId: string) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)
        },
        catch: (error) => new UserRoleDatabaseError({ cause: error }),
      })

      return result[0]?.role ?? undefined
    }),
})
