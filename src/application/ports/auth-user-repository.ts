/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for auth user operations
 */
export class AuthUserDatabaseError extends Data.TaggedError('AuthUserDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Auth User Repository Port
 *
 * Provides type-safe database operations for auth user management.
 * Implementation lives in infrastructure layer (auth-user-service.ts).
 */
export class AuthUserRepository extends Context.Tag('AuthUserRepository')<
  AuthUserRepository,
  {
    readonly verifyUserEmail: (userId: string) => Effect.Effect<void, AuthUserDatabaseError>
  }
>() {}
