/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { UserViewRepositoryLive } from '@/infrastructure/database/repositories/user-view-repository-live'

const UserViewRuntimeLayer = Layer.provide(UserViewRepositoryLive, DatabaseLive)

export function provideDatabaseLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, UserViewRuntimeLayer) as Effect.Effect<A, E, never>
}
