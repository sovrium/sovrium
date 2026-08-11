/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Provide the user-table-preferences runtime layer to a preferences Effect
 * program. Mirror of the sibling `user-views/effect-runner.ts`.
 *
 * Phase 9 Cycle 5 — composes `UserTablePreferencesRepositoryLive` (which
 * needs `Database`) over `DatabaseLive`, isolating the infrastructure import
 * at this single presentation-layer boundary.
 */

import { Effect, Layer } from 'effect'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { UserTablePreferencesRepositoryLive } from '@/infrastructure/database/repositories/tables/user-table-preferences-repository-live'

const UserTablePreferencesRuntimeLayer = Layer.provide(
  UserTablePreferencesRepositoryLive,
  DatabaseLive
)

export function provideDatabaseLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, UserTablePreferencesRuntimeLayer) as Effect.Effect<A, E, never>
}
