/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { OAuthStateStoreLive } from '@/infrastructure/connections/oauth-state-store-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'

const ConnectionRuntimeLayer = Layer.mergeAll(
  ConnectionRepositoryLive,
  ConnectionTokenRepositoryLive,
  OAuthStateStoreLive
)

export function provideConnectionLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, ConnectionRuntimeLayer) as Effect.Effect<A, E, never>
}
