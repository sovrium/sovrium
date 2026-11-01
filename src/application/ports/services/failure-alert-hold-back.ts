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
 * and how many failures it has held back since that the history did not
 * record. The rules are pure (`decideHoldBack`, `takeHeldBack` in the
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
    /** Take, and forget, every failure held back in memory since the last roll-up. */
    readonly take: Effect.Effect<{
      readonly groups: readonly RollupGroup[]
      readonly overflow: HeldBackTally | undefined
    }>
  }
>()('FailureAlertHoldBack') {}
