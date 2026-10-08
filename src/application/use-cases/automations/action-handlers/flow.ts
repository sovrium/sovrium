/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { stopAnswer } from './response-precedence'
import { authoredActionProps, resolveOwnProp } from './run-context-resolution'
import type { ActionHandler, ActionOutcome } from './shared'

/**
 * `flow/stop` handler — terminate the run early, optionally with a status,
 * message, and structured output that surface in the synchronous trigger
 * response.
 *
 * Halting reuses the `automation:return` early-exit mechanism: a non-undefined
 * `returnData` sets `acc.halted` so subsequent actions are skipped (see
 * `run-automation.ts#pickReturnData`). The response body is shaped via
 * `responseOverride` so the dispatcher returns `{ status, message?, output? }`
 * verbatim instead of the default `{ success, id, status: 'completed' | 'failed' }`
 * envelope — STOP-001/002 assert against `body.status` / `body.message`
 * directly, STOP-003 against `body.output.*`.
 *
 * Templates in `props.output` (`{{steps.compute.total}}`) are resolved here
 * against the run context so whole-string references keep their original
 * type (number/array/object) — the run loop's global pass stringifies, so
 * this handler reads its props as AUTHORED like `data/set` does.
 * The HTTP status stays 200 regardless of the stop status (STOP-001 asserts
 * `response.status() === 200` even for `status: 'error'`), so the handler
 * itself records `status: 'success'` and lets `responseOverride` carry the
 * semantic stop status in the body.
 *
 * Spec: the automation action flow stop specs + REGRESSION.
 */
export const handleFlowStop: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.sync(() => {
    if (runContext === undefined) {
      return { status: 'success' } as const satisfies ActionOutcome
    }
    const props = authoredActionProps(runContext)
    const rawStatus = resolveOwnProp(runContext, props['status'])
    const status = rawStatus === 'success' ? 'success' : 'error'
    const message =
      props['message'] !== undefined
        ? String(resolveOwnProp(runContext, props['message']))
        : undefined
    const output =
      props['output'] !== undefined &&
      typeof props['output'] === 'object' &&
      props['output'] !== null
        ? (resolveOwnProp(runContext, props['output']) as Record<string, unknown>)
        : undefined
    const body: Readonly<Record<string, unknown>> = {
      status,
      ...(message !== undefined ? { message } : {}),
      ...(output !== undefined ? { output } : {}),
    }
    return {
      status: 'success',
      // The stop's answer is the caller's only when no response was set before it.
      responseOverride: stopAnswer(body),
      returnData: {},
    } as const satisfies ActionOutcome
  }).pipe(Effect.withSpan('automations.handle-flow-stop'))
