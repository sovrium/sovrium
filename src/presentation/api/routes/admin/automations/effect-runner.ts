/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AdminAutomationsLayer } from '@/application/use-cases/admin/automations-overview'

/**
 * Provide AdminAutomationsLayer to an Effect program.
 *
 * Isolates the infrastructure import (the repository Live layer, bundled in
 * `AdminAutomationsLayer`) so the admin/automations route handlers depend only
 * on the application layer. This is the composition root for the three
 * `GET /api/admin/automations/*` endpoints.
 */
export function provideAdminAutomationsLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AdminAutomationsLayer) as Effect.Effect<A, E, never>
}
