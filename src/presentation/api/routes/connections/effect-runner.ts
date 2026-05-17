/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { OAuthStateStoreLive } from '@/infrastructure/connections/oauth-state-store-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connection-token-repository-live'

/**
 * Provide the connection-route runtime layers.
 *
 * Provides:
 * - `ConnectionRepository` (find-or-create the system.connections row
 *   for a given connection name on first authorize)
 * - `ConnectionTokenRepository` (encrypted per-user token storage)
 * - `OAuthStateStore` (in-memory state-token store for the
 *   authorize→callback hop)
 */
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
