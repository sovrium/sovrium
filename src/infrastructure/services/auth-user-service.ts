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
 * Database error for auth user operations
 */
export class AuthUserDatabaseError extends Data.TaggedError('AuthUserDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Auth User Service
 *
 * Provides type-safe database operations for auth user management using Drizzle ORM.
 * Encapsulates direct database access for auth-related user mutations.
 */
export class AuthUserService extends Context.Tag('AuthUserService')<
  AuthUserService,
  {
    readonly verifyUserEmail: (userId: string) => Effect.Effect<void, AuthUserDatabaseError>
  }
>() {}

/**
 * Auth User Service Implementation
 */
export const AuthUserServiceLive = Layer.succeed(AuthUserService, {
  verifyUserEmail: (userId: string) =>
    Effect.tryPromise({
      try: () => db.update(users).set({ emailVerified: true }).where(eq(users.id, userId)),
      catch: (error) => new AuthUserDatabaseError({ cause: error }),
    }).pipe(Effect.asVoid),
})
