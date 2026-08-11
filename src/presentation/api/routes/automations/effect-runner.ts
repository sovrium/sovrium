/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import type { Effect } from 'effect'

/**
 * Provide the automation runtime's required infrastructure layers.
 *
 * Thin re-export of the shared {@link provideAutomationRuntime} adapter so
 * route handlers in this folder keep their existing import path.
 *
 * Isolating the `@/infrastructure/*` reach into a single shared module
 * lets the live cron scheduler (and any future background dispatcher)
 * provide the same runtime layer without duplicating wiring.
 */
export function provideAutomationLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return provideAutomationRuntime(program)
}
