/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for auth operations (users table)
 */
export class AuthDatabaseError extends Data.TaggedError('AuthDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Auth Repository Port
 *
 * Provides type-safe database operations for authentication-related
 * user management (email verification, role lookup).
 * Both methods operate on the Better Auth `users` table.
 *
 * Implementation lives in infrastructure layer (auth-repository-live.ts).
 */
export class AuthRepository extends Context.Tag('AuthRepository')<
  AuthRepository,
  {
    readonly verifyUserEmail: (userId: string) => Effect.Effect<void, AuthDatabaseError>
    readonly getUserRole: (userId: string) => Effect.Effect<string | undefined, AuthDatabaseError>
  }
>() {}
