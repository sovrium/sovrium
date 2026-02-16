/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { UserRoleService, UserRoleServiceLive } from '@/infrastructure/services/user-role-service'

// Constants
const DEFAULT_ROLE = 'member'

/**
 * Retrieves the user's global role from the database
 *
 * Delegates to UserRoleService (infrastructure layer) for database access.
 * This application layer function provides a convenient async interface
 * for use in presentation layer middleware and routes.
 *
 * Role resolution:
 * 1. Fetch global user role from users table via UserRoleService
 * 2. Default: 'member'
 */
export async function getUserRole(userId: string): Promise<string> {
  const program = Effect.gen(function* () {
    const service = yield* UserRoleService
    return yield* service.getUserRole(userId)
  }).pipe(Effect.provide(UserRoleServiceLive))

  const role = await Effect.runPromise(program)

  return role ?? DEFAULT_ROLE
}
