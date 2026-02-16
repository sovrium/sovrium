/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for user role operations
 */
export class UserRoleDatabaseError extends Data.TaggedError('UserRoleDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * User Role Repository Port
 *
 * Provides type-safe database operations for user roles.
 * Implementation lives in infrastructure layer (user-role-service.ts).
 */
export class UserRoleRepository extends Context.Tag('UserRoleRepository')<
  UserRoleRepository,
  {
    readonly getUserRole: (
      userId: string
    ) => Effect.Effect<string | undefined, UserRoleDatabaseError>
  }
>() {}
