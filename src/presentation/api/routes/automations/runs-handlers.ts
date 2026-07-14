/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import {
  replayAutomationRun,
  type ReplayAutomationRunError,
} from '@/application/use-cases/automations/replay-automation-run'
import {
  resolveAutomationApproval,
  type ResolveApprovalError,
} from '@/application/use-cases/automations/resolve-automation-approval'
import { signalCancellation } from '@/application/use-cases/automations/run/scheduler'
import { provideAutomationLive } from './effect-runner'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

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
    { triggerData?: Record<string, unknown>; fromStep?: string } | undefined
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

const resolveApprovalErrorResponse = (c: Context, error: ResolveApprovalError) => {
  if (error._tag === 'ApprovalAlreadyResolved') {
    return c.json(
      { success: false, message: `Approval already ${error.status}`, status: error.status },
      409
    )
  }
  return c.json({ success: false, message: 'Approval not found' }, 404)
}

export async function handleResolveApproval(c: Context, app: App, decision: 'approve' | 'reject') {
  const runId = c.req.param('runId')
  const approvalId = c.req.param('approvalId')
  if (runId === undefined || approvalId === undefined) {
    return c.json({ success: false, message: 'Run id and approval id required' }, 400)
  }

  const program = resolveAutomationApproval({
    runId,
    approvalId,
    decision,
    app,
    processEnv: process.env,
  })
  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))
  if (result._tag === 'Left') {
    return resolveApprovalErrorResponse(c, result.left)
  }
  return c.json({ success: true, runId, approvalId, status: result.right.decision }, 200)
}

export function chainRunControlRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .post('/api/automations/runs/:id/replay', (c) => handleReplayRunById(c, app))
    .post('/api/automations/runs/:id/cancel', (c) => handleCancelRun(c, app))
    .post('/api/automations/runs/:runId/approvals/:approvalId/approve', (c) =>
      handleResolveApproval(c, app, 'approve')
    )
    .post('/api/automations/runs/:runId/approvals/:approvalId/reject', (c) =>
      handleResolveApproval(c, app, 'reject')
    ) as T
}
