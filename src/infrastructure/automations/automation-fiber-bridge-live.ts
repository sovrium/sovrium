/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import { trackBackgroundRun } from './background-runs'
import type { Context } from 'effect'

/**
 * Cross a Promise boundary WITHOUT leaving the caller's services behind.
 *
 * The code-action sandbox hands user JavaScript an `actions.ref(...)` method,
 * and `automation:call` hands it an invoker; both must return a Promise,
 * because that is the contract a `function` inside the sandbox can consume.
 * The boundary is therefore imposed by the sandbox, not chosen by the run loop.
 *
 * What IS chosen is what supplies the sub-program's services on the far side
 * of it. Providing the whole `AutomationRuntimeLayer` per invocation would make
 * an automation whose code action dispatches N steps build N copies of every
 * repository, the AI service and the storage service included, while the fiber
 * that called it already holds one set. This takes the CALLER's services: `Effect.context` captures what
 * the run loop is running on, and nothing is constructed here at all.
 *
 * It lives in infrastructure rather than in the use case for the reason
 * standing rule E1 gives — a use case declares `R` and never runs — and the
 * run loop reaches it through the `AutomationFiberBridge` port.
 */
const runOnAutomationServices =
  <R>(services: Context.Context<R>) =>
  <A, E>(program: Effect.Effect<A, E, R>): Promise<A> =>
    Effect.runPromiseWith(services)(program)

/** Live `AutomationFiberBridge` — the caller-services Promise runner and the background-run registry. */
export const AutomationFiberBridgeLive = Layer.succeed(
  AutomationFiberBridge,
  AutomationFiberBridge.of({
    promiseRunner: runOnAutomationServices,
    trackBackground: trackBackgroundRun,
  })
)
