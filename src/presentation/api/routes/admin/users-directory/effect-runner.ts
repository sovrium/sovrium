/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { UsersDirectoryLayer } from '@/application/use-cases/admin/users-directory'

/**
 * Provide UsersDirectoryLayer to an Effect program.
 *
 * Isolates the infrastructure import (the repository Live layer, bundled in
 * `UsersDirectoryLayer`) so the users-directory route handler depends only on
 * the application layer. This is the composition root for `GET /api/admin/users`.
 */
export function provideUsersDirectoryLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, UsersDirectoryLayer) as Effect.Effect<A, E, never>
}
