/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { UserEntityListsLayer } from '@/application/use-cases/user-entity-lists'

/**
 * Provide UserEntityListsLayer to an Effect program.
 *
 * Isolates the infrastructure import (the repository Live layer, bundled in
 * `UserEntityListsLayer`) so the favorites/recent route handlers depend only on
 * the application layer. This is the composition root for both `/api/favorites`
 * and `/api/recent` — `recent.ts` imports this same runner.
 */
export function provideUserEntityListsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, UserEntityListsLayer) as Effect.Effect<A, E, never>
}
