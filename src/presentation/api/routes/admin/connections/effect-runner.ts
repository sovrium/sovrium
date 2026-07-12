/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AdminConnectionsLayer } from '@/application/use-cases/admin/connections'

export function provideAdminConnectionsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AdminConnectionsLayer) as Effect.Effect<A, E, never>
}
