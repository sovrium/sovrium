/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { AuthRepository, AuthDatabaseError } from '@/application/ports/repositories/auth-repository'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'

/**
 * Auth Repository Implementation
 *
 * Provides database operations for auth-related user management.
 * Both methods operate on the Better Auth `users` table via Drizzle ORM.
 */
export const AuthRepositoryLive = Layer.succeed(AuthRepository, {
  verifyUserEmail: (userId: string) =>
    Effect.tryPromise({
      try: () => db.update(users).set({ emailVerified: true }).where(eq(users.id, userId)),
      catch: (error) => new AuthDatabaseError({ cause: error }),
    }).pipe(Effect.asVoid),

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
        catch: (error) => new AuthDatabaseError({ cause: error }),
      })

      return result[0]?.role ?? undefined
    }),
})
