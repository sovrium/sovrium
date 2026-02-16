/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { UserRoleRepository, UserRoleDatabaseError } from '@/application/ports/user-role-repository'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'

/**
 * User Role Repository Implementation
 *
 * Uses Drizzle ORM query builder for type-safe, SQL-injection-proof queries.
 */
export const UserRoleRepositoryLive = Layer.succeed(UserRoleRepository, {
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
