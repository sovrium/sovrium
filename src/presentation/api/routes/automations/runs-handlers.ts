/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Name-less variants of the runs-by-id endpoints (replay + cancel).
 *
 * Extracted from `./index.ts` so the route-chaining module stays within
 * its `max-lines` cap. The "name-less" qualifier means these endpoints
 * derive the automation name from the persisted run row (looking it up
 * by id), rather than receiving the name as a URL path parameter — the
 * sibling `:name/runs/:id/replay` route in `./index.ts` is the name-bearing
 * counterpart.
 *
 * Used by API-AUTOMATION-RUNS-005, 006, and 007 (replay + cancel) which
 * post to `/api/automations/runs/:id/...` directly.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automation-run-repository'
import {
  replayAutomationRun,
  type ReplayAutomationRunError,
} from '@/application/use-cases/automations/replay-automation-run'
import { provideAutomationLive } from './effect-runner'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Effect program that loads the run + its steps from the DB-backed
 * repository. Duplicated minimally from `index.ts::loadDbRunDetail` so
 * this module remains a leaf import (no cycle back to `index.ts`).
 */
const loadRunForReplay = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const run = yield* repo.findById(id)
    return run
  })

/**
 * Translate a replay error into the appropriate HTTP response. Mirrors
 * the identical helper inside `./index.ts`; kept here so the name-less
 * handler can self-contain its error mapping.
 */
const replayErrorResponse = (c: Context, error: ReplayAutomationRunError) => {
  if (
    error._tag === 'AutomationNotFound' ||
    error._tag === 'AutomationRunNotFound' ||
    error._tag === 'AutomationRunMismatch'
  ) {
    return c.json({ success: false, message: 'Run not found' }, 404)
  }
  if (error._tag === 'AutomationRegistrySeedError') {
    return c.json({ success: false, message: 'Failed to register automation in the database' }, 500)
  }
  return c.json({ success: false, message: 'Run not replayable' }, 400)
}

/**
 * Handle POST /api/automations/runs/:id/replay
 *
 * Name-less variant of the replay endpoint. Resolves the automation name
 * from the persisted run row, then delegates to the same replay flow as
 * the `:name`-bearing endpoint. API-AUTOMATION-RUNS-005/006.
 *
 * Response shape includes both `id` and `runId` so callers can use either
 * field. `status: 'accepted'` indicates the replay was queued (the
 * underlying run may have already completed synchronously by the time the
 * response is sent; `'accepted'` is purely a "the replay command was
 * honoured" signal).
 */
export async function handleReplayRunById(c: Context, app: App) {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }

  const lookup = await Effect.runPromise(Effect.either(provideAutomationLive(loadRunForReplay(id))))
  if (lookup._tag === 'Left' || lookup.right === undefined) {
    return c.json({ success: false, message: 'Run not found' }, 404)
  }
  const name = lookup.right.automationName

  const body = (await c.req.json().catch(() => undefined)) as
    | { triggerData?: Record<string, unknown>; fromStep?: string }
    | undefined
  const overrideTriggerData =
    body !== undefined && body.triggerData !== undefined && body.triggerData !== null
      ? (body.triggerData as Record<string, unknown>)
      : undefined

  const program = replayAutomationRun({
    name,
    runId: id,
    app,
    processEnv: process.env,
    ...(overrideTriggerData !== undefined ? { triggerData: overrideTriggerData } : {}),
  })
  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))

  if (result._tag === 'Left') {
    return replayErrorResponse(c, result.left)
  }
  // RUNS-005/006 contract: surface both `id` and `runId` plus `status: 'accepted'`.
  return c.json(
    {
      id: result.right.runId,
      runId: result.right.runId,
      status: 'accepted',
    },
    200
  )
}

/**
 * Handle POST /api/automations/runs/:id/cancel
 *
 * Mark a run as `'cancelled'` in `system.automation_runs`. API-AUTOMATION-RUNS-007.
 *
 * Best-effort status update on the persisted row; does NOT actively
 * interrupt an in-flight run loop (that would require an AbortController
 * threaded through the run engine, which is out of scope here). Operators
 * relying on this should treat cancellation as a flag the engine MAY
 * observe between steps.
 */
export async function handleCancelRun(c: Context, _app: App) {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }

  const program = Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    return yield* repo.updateStatus({ id, status: 'cancelled' })
  })
  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))
  if (result._tag === 'Left' || result.right === undefined) {
    return c.json({ success: false, message: 'Run not found' }, 404)
  }
  return c.json({ id, status: 'cancelled' }, 200)
}
