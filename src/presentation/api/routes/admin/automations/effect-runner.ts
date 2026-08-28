/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AdminAutomationsLayer } from '@/application/use-cases/admin/automations-overview'
import { AutomationPauseRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-pause-repository-live'

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

/**
 * Provide AutomationPauseRepositoryLive to an Effect program.
 *
 * The composition root for the catalog + pause/resume endpoints. Kept separate
 * from {@link provideAdminAutomationsLive} because those three endpoints read
 * CONFIG plus the pause table and never touch `automation_runs` — merging the
 * two layers would hand them a run-history repository they have no use for.
 */
export function provideAutomationPauseLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AutomationPauseRepositoryLive) as Effect.Effect<A, E, never>
}
