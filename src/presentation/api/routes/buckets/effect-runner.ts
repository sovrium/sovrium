/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'

/**
 * Provide StorageServiceLive to a bucket-route Effect program.
 *
 * Mirrors `provideAnalyticsLive` in `src/presentation/api/routes/analytics/effect-runner.ts`.
 * Isolates the infrastructure import so route handlers depend only on the
 * application-layer `StorageService` port — keeps the presentation layer
 * free of direct infrastructure imports per the layer-based architecture.
 */
export function provideStorageLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, StorageServiceLive) as Effect.Effect<A, E, never>
}
