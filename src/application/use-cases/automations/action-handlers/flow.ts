/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
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
 * this handler reads the RAW pre-substitution action like `data/set` does.
 * The HTTP status stays 200 regardless of the stop status (STOP-001 asserts
 * `response.status() === 200` even for `status: 'error'`), so the handler
 * itself records `status: 'success'` and lets `responseOverride` carry the
 * semantic stop status in the body.
 *
 * Spec: APP-AUTOMATION-ACTION-FLOW-STOP-001..003 + REGRESSION.
 */
export const handleFlowStop: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.sync(() => {
    if (runContext === undefined) {
      return { status: 'success' } as const satisfies ActionOutcome
    }
    const props = rawActionProps(runContext)
    const ctx = buildRunContextView(runContext)
    const rawStatus = resolveRunContextValue(props['status'], ctx)
    const status = rawStatus === 'success' ? 'success' : 'error'
    const message =
      props['message'] !== undefined
        ? String(resolveRunContextValue(props['message'], ctx))
        : undefined
    const output =
      props['output'] !== undefined &&
      typeof props['output'] === 'object' &&
      props['output'] !== null
        ? (resolveRunContextValue(props['output'], ctx) as Record<string, unknown>)
        : undefined
    const body: Record<string, unknown> = {
      status,
      ...(message !== undefined ? { message } : {}),
      ...(output !== undefined ? { output } : {}),
    }
    return {
      status: 'success',
      responseOverride: { status: 200, body, headers: {} },
      returnData: {},
    } as const satisfies ActionOutcome
  })
