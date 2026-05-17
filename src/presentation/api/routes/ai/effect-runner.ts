/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AiLive } from '@/infrastructure/ai/layer'

/**
 * Provide AiLive to an AI-route Effect program.
 *
 * Mirrors `provideStorageLive` in
 * `src/presentation/api/routes/buckets/effect-runner.ts`. Isolates the
 * infrastructure import so route handlers depend only on the application-
 * layer `AiService` port — keeps the presentation layer free of direct
 * infrastructure imports per the layer-based architecture.
 */
export function provideAiLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AiLive) as Effect.Effect<A, E, never>
}
