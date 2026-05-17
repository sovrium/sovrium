/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics-repository-live'

/**
 * Provide AnalyticsRepositoryLive layer to an Effect program
 *
 * Isolates the infrastructure import so analytics route handlers
 * only depend on the application layer.
 *
 * @param program - The Effect program requiring AnalyticsRepository
 * @returns Effect program with AnalyticsRepositoryLive provided
 */
export function provideAnalyticsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AnalyticsRepositoryLive) as Effect.Effect<A, E, never>
}
