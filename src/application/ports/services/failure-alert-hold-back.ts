/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The failure-alert hold-back the server keeps in memory.
 *
 * The hourly hold-back of failure alerts is read from the run history, and a
 * database that refuses writes leaves no history to read. This port is the
 * server's own memory of it: when each automation last had an immediate alert,
 * how many failures it has held back since that the history did not record,
 * which runs were emailed at once, and when each automation last recovered. The rules are pure (`decideHoldBack`, `takeHeldBack` in the
 * automation run-outcome service); the port holds the state between calls.
 *
 * Process-local by design, and bounded: a restart forgets it, exactly as it
 * forgets the in-memory run queues.
 */

import { Context, type Effect } from 'effect'
import type {
  FinalFailure,
  HoldBackDecision,
  HeldBackTally,
  RollupGroup,
} from '@/domain/models/app/automations/automation-run-outcome-service'

export class FailureAlertHoldBack extends Context.Service<
  FailureAlertHoldBack,
  {
    /**
     * Decide, and remember, whether `failure` is emailed at once. `history` is
     * what the database answered for the hour up to it, `undefined` when it
     * could not be read.
     */
    readonly decide: (
      failure: FinalFailure,
      history: readonly FinalFailure[] | undefined
    ) => Effect.Effect<HoldBackDecision>
    /** Remember that a run of `automationName` succeeded at `at`, whatever its history keeps. */
    readonly recordSuccess: (automationName: string, at: Readonly<Date>) => Effect.Effect<void>
    /**
     * Take, and forget, every failure held back in memory since the last
     * roll-up; read the runs emailed at once and the recoveries the server saw.
     */
    readonly take: Effect.Effect<{
      readonly groups: readonly RollupGroup[]
      readonly overflow: HeldBackTally | undefined
      readonly alerted: ReadonlySet<string>
      readonly recoveries: ReadonlyMap<string, Date>
    }>
  }
>()('FailureAlertHoldBack') {}
