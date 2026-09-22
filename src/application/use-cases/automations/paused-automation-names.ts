/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Load the set of operationally-paused automation names, once per dispatch.
 *
 * `isAutomationOperationallyEnabled` is deliberately pure and synchronous — see
 * `domain/utils/automation-operational-state.ts` for why — so the paused-name
 * set has to be read at the ENTRY POINT and threaded down into the gate. This
 * module is that read, in the one shape every Effect-based entry point needs.
 *
 * ## Why a database failure yields an EMPTY set rather than an error
 *
 * The alternative is fail-CLOSED: treat "cannot read the pause table" as
 * "everything is paused". That turns a transient database blip into a total
 * automation outage across every trigger path at once — strictly worse than the
 * thing it protects against, and it would take down webhook, cron, record,
 * form, auth and comment dispatch simultaneously.
 *
 * Failing OPEN degrades to exactly the behaviour that shipped before this
 * feature existed: the config `enabled` flag still gates, and the operational
 * pause is momentarily not enforced. It is a real weakening, so it is LOGGED at
 * error level rather than swallowed — a pause that silently stops working is
 * the failure mode this feature exists to prevent, and an operator needs to see
 * it in the logs.
 *
 * In practice a failure here is near-inseparable from a database outage, in
 * which case the run itself cannot persist and fails downstream regardless.
 */

import { Effect } from 'effect'
import { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import { logError } from '@/infrastructure/logging/logger'

/** The fail-open value: no automation is paused. */
const NO_PAUSES: ReadonlySet<string> = new Set<string>()

/**
 * Read every paused automation name.
 *
 * Never fails (`E = never`) so it can be `yield*`ed inside the dispatch
 * use-cases whose own error channel is `never` (`triggerRecordEventAutomations`
 * and its siblings) without widening their contract.
 */
export const loadPausedAutomationNames: Effect.Effect<
  ReadonlySet<string>,
  never,
  AutomationPauseRepository
> = Effect.gen(function* () {
  const repository = yield* AutomationPauseRepository
  return yield* repository.listPausedNames
}).pipe(
  Effect.catch((error) =>
    Effect.sync(() => {
      logError('[automations] failed to read operational pauses; treating none as paused', error)
      return NO_PAUSES
    })
  ),
  Effect.withSpan('automations.load-paused-automation-names')
)
