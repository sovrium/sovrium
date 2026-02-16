/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { AuthUserRepository, AuthUserDatabaseError } from '@/application/ports/auth-user-repository'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'

/**
 * Auth User Repository Implementation
 */
export const AuthUserRepositoryLive = Layer.succeed(AuthUserRepository, {
  verifyUserEmail: (userId: string) =>
    Effect.tryPromise({
      try: () => db.update(users).set({ emailVerified: true }).where(eq(users.id, userId)),
      catch: (error) => new AuthUserDatabaseError({ cause: error }),
    }).pipe(Effect.asVoid),
})
