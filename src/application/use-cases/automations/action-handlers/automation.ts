/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import type { ActionHandler, ActionOutcome } from './shared'

const fail = (error: string): Effect.Effect<ActionOutcome> =>
  Effect.succeed({ status: 'failure', error } as const satisfies ActionOutcome)

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

export const handleAutomationReturn: ActionHandler = (action) => {
  const props = (action['props'] ?? {}) as Readonly<Record<string, unknown>>
  const data = (props['data'] ?? {}) as Readonly<Record<string, unknown>>
  return Effect.succeed({ status: 'success', returnData: data } as const satisfies ActionOutcome)
}
