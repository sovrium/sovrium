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
