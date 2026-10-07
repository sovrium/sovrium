/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two places the automation run loop must leave the fiber it runs on, as a
 * capability the loop declares rather than performs (standing rule E1: a use
 * case declares `R` and never runs).
 *
 * - {@link AutomationFiberBridge.promiseRunner}: the code-action sandbox and
 *   `automation:call` hand user code a function that must return a Promise.
 *   The runner crosses that boundary on the CALLER's services — nothing is
 *   constructed on the far side.
 * - {@link AutomationFiberBridge.trackBackground}: a record event a step writes
 *   starts automations the step does not wait for. Tracking them is what lets a
 *   stopping server drain them instead of cutting them off mid-write.
 */

import { Context, type Effect } from 'effect'

export class AutomationFiberBridge extends Context.Service<
  AutomationFiberBridge,
  {
    readonly promiseRunner: <R>(
      services: Context.Context<R>
    ) => <A, E>(program: Effect.Effect<A, E, R>) => Promise<A>
    readonly trackBackground: <A, E, R>(program: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  }
>()('AutomationFiberBridge') {}
