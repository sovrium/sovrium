/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ListActivityLogsLayer } from '@/application/use-cases/list-activity-logs'
import { DatabaseLive } from '@/infrastructure/database'

/**
 * Provide DatabaseLive layer to an Effect program
 *
 * Isolates the infrastructure import so activity route handlers
 * only depend on the application layer.
 */
export function provideActivityLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, DatabaseLive) as Effect.Effect<A, E, never>
}

/**
 * Provide ListActivityLogsLayer to an Effect program
 *
 * ListActivityLogsLayer bundles DatabaseLive + repository implementations
 * needed for the list-activity-logs use case.
 */
export function provideListActivityLogsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, ListActivityLogsLayer) as Effect.Effect<A, E, never>
}
