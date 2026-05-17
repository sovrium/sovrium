/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import type { ActionHandler, ActionOutcome } from './shared'

/**
 * `automation/call` handler — invoke another automation as a sub-workflow.
 *
 * The heavy lifting (target resolution, inputSchema validation, recursion
 * guard, running the callee through the shared engine loop) lives in the
 * `invokeAutomation` callback threaded through the run context by
 * `run-automation.ts` — the handler file cannot import the run loop
 * directly without a circular dependency. The callee's `automation:return`
 * payload comes back wrapped as `{ result }` and is surfaced as the call
 * step's output (so the caller reads it via `steps.{name}.result`).
 *
 * `mode: 'async'` fires the callee fire-and-forget; the call step still
 * records `{ result: {} }` so subsequent actions stay total.
 *
 * Spec: APP-AUTOMATION-ACTION-AUTOMATION-CALL-001..005 + REGRESSION.
 */
const fail = (error: string): Effect.Effect<ActionOutcome> =>
  Effect.succeed({ status: 'failure', error } as const satisfies ActionOutcome)

/** Resolve `maxDepth` from props with a default of 10. */
const resolveMaxDepth = (raw: unknown): number =>
  typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 10

export const handleAutomationCall: ActionHandler = (action, _app, _automation, runContext) => {
  const props = (action['props'] ?? {}) as Readonly<Record<string, unknown>>
  const name = String(props['name'] ?? '')
  if (name === '') {
    return fail("automation:call requires a 'name' prop referencing the automation to invoke")
  }
  const invoke = runContext?.invokeAutomation
  if (invoke === undefined) {
    return fail('automation:call is not available in this execution context')
  }
  const inputData = (props['inputData'] ?? {}) as Readonly<Record<string, unknown>>
  const mode = props['mode'] === 'async' ? 'async' : 'sync'
  return Effect.tryPromise({
    try: () => invoke({ name, inputData, mode, maxDepth: resolveMaxDepth(props['maxDepth']) }),
    catch: (cause) => (cause instanceof Error ? cause.message : String(cause)),
  }).pipe(
    Effect.map(
      ({ result }) => ({ status: 'success', output: { result } }) as const satisfies ActionOutcome
    ),
    Effect.catchAll((error) => fail(error))
  )
}

/**
 * `automation/return` handler — hand a key-value payload back to the
 * `automation:call` caller. Templates in `props.data` are resolved by the
 * run loop before this handler runs (it sees concrete values), so the
 * handler just forwards the object as `outcome.returnData`. The run loop
 * short-circuits the remaining actions in the callee once a `return`
 * fires (early-exit semantics).
 *
 * Outside an `automation-call` context the payload simply has nowhere to
 * go — the action still succeeds (the run completes normally), matching
 * APP-AUTOMATION-ACTION-AUTOMATION-RETURN-002 ("ineffective, not an error").
 *
 * Spec: APP-AUTOMATION-ACTION-AUTOMATION-RETURN-001..004 + REGRESSION.
 */
export const handleAutomationReturn: ActionHandler = (action) => {
  const props = (action['props'] ?? {}) as Readonly<Record<string, unknown>>
  const data = (props['data'] ?? {}) as Readonly<Record<string, unknown>>
  return Effect.succeed({ status: 'success', returnData: data } as const satisfies ActionOutcome)
}
