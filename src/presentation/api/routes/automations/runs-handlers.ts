/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automation-run-repository'
import {
  replayAutomationRun,
  type ReplayAutomationRunError,
} from '@/application/use-cases/automations/replay-automation-run'
import { signalCancellation } from '@/application/use-cases/automations/run/scheduler'
import { provideAutomationLive } from './effect-runner'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

const loadRunForReplay = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const run = yield* repo.findById(id)
    return run
  })

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
  return c.json(
    {
      id: result.right.runId,
      runId: result.right.runId,
      status: 'accepted',
    },
    200
  )
}

export async function handleCancelRun(c: Context, _app: App) {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }

  signalCancellation(id)

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
