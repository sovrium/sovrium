/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automation run scheduler the server keeps in memory.
 *
 * Two pieces of cross-run state no single run can own:
 *
 *   1. **Admission** — for each automation, a cap on the runs that execute at
 *      once (`automation.concurrency.limit`). A run beyond it waits, in arrival
 *      order, until one in flight gives its slot back.
 *   2. **Cancellation** — the runs a cancel request can still reach, by id. The
 *      cancel endpoint flags one; the run reads the flag between its phases and
 *      ends as `cancelled`.
 *
 * Both are SCOPED: a slot and a registration are handed back when the caller's
 * scope closes, however it closes — success, failure, a defect, or an
 * interruption, including one that lands while the run is still waiting for
 * its slot. A run that could leave either behind would lower its automation's
 * effective concurrency for the life of the server.
 *
 * One instance per server runtime, single-process by design: a restart forgets
 * the queues, while the run rows keep every queued/running/terminal transition.
 */

import { Context, type Effect, type Scope } from 'effect'

export class AutomationScheduler extends Context.Service<
  AutomationScheduler,
  {
    /**
     * Take one of `automationName`'s `limit` slots, waiting until one frees.
     * The slot is given back when the caller's scope closes, or earlier through
     * the effect answered, which gives it back at most once.
     */
    readonly admit: (
      automationName: string,
      limit: number
    ) => Effect.Effect<Effect.Effect<void>, never, Scope.Scope>
    /** How many runs of `automationName` are waiting for one of its slots right now. */
    readonly waiting: (automationName: string) => Effect.Effect<number>
    /**
     * Make `runId` cancellable for the caller's scope, replacing any earlier
     * registration of it. The effect answered drops the registration early; it
     * never drops a later caller's registration of the same run.
     */
    readonly registerCancellation: (
      runId: string
    ) => Effect.Effect<Effect.Effect<void>, never, Scope.Scope>
    /**
     * {@link registerCancellation}, only when no registration holds the run
     * already: `undefined` then, since another caller in this process owns it.
     */
    readonly registerCancellationIfAbsent: (
      runId: string
    ) => Effect.Effect<Effect.Effect<void> | undefined, never, Scope.Scope>
    /** Flag `runId` as cancelled. `false` when no registration holds it (the run already ended). */
    readonly signalCancellation: (runId: string) => Effect.Effect<boolean>
    /** Whether `runId` is registered and flagged as cancelled. */
    readonly isCancelled: (runId: string) => Effect.Effect<boolean>
  }
>()('AutomationScheduler') {}
