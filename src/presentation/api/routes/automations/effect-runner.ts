/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect as EffectRuntime } from 'effect'
import { loadPausedAutomationNames } from '@/application/use-cases/automations/paused-automation-names'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { AutomationPauseRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-pause-repository-live'
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

/**
 * Read the operationally-paused automation names from a plain `async` handler.
 *
 * Two of the eleven runtime gates sit in SYNCHRONOUS presentation code with no
 * Effect scope to `yield*` from: the webhook lookup gate in this folder — which
 * must decide before auth runs, so a paused automation cannot answer 401 where a
 * config-disabled one answers 404 — and the record-update trigger fast path in
 * `routes/tables/record/`. Both are reached from an `async` handler, so they
 * `await` this adapter instead.
 *
 * It lives here, beside {@link provideAutomationLive}, because this module is
 * already the composition root that owns the automation dependency wiring for
 * the route layer (`record-button-handlers.ts` in the tables folder imports
 * from here for exactly that reason). The equivalent module under
 * `infrastructure/automations/` would be a layer violation — infrastructure may
 * not reach into an application use-case.
 *
 * Fail-open semantics (an unreadable pause table yields an EMPTY set, logged)
 * are defined and justified in the application-layer
 * `loadPausedAutomationNames`; this only provides the Live layer.
 */
export function loadPausedAutomationNamesAsync(): Promise<ReadonlySet<string>> {
  return EffectRuntime.runPromise(
    EffectRuntime.provide(loadPausedAutomationNames, AutomationPauseRepositoryLive)
  )
}
