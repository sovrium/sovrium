/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AdminAgentConversationsLayer } from '@/application/use-cases/admin/agent-conversations'

/**
 * Provide AdminAgentConversationsLayer to an Effect program.
 *
 * Isolates the infrastructure import (the repository Live layer, bundled in
 * `AdminAgentConversationsLayer`) so the admin/agents conversation route
 * handlers depend only on the application layer. This is the composition root
 * for `GET /api/admin/agents/:name/conversations` + `.../:id`.
 */
export function provideAdminAgentConversationsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AdminAgentConversationsLayer) as Effect.Effect<A, E, never>
}
