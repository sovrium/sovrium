/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import {
  BuildAdminRunDetail,
  BuildAdminRunsList,
  BuildAutomationsOverview,
} from '@/application/use-cases/admin/automations-overview'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import {
  retryAutomationRun,
  type RetryAutomationRunOptions,
} from '@/application/use-cases/automations/retry-automation-run'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  automationsOverviewQuerySchema,
  automationsRunsDetailParamsSchema,
  automationsRunsListQuerySchema,
  type AutomationRunAdminItem,
} from '@/domain/models/api/admin/automations'
import { provideAdminAutomationsLive } from '@/presentation/api/routes/admin/automations/effect-runner'
import { provideAutomationLive } from '@/presentation/api/routes/automations/effect-runner'
import type { ReplayAutomationRunError } from '@/application/use-cases/automations/replay-automation-run'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'



async function handleAutomationsOverview(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedQuery = automationsOverviewQuerySchema.safeParse({
    period: c.req.query('period'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const period = parsedQuery.data.period ?? '24h'

  const outcome = await Effect.runPromise(
    BuildAutomationsOverview(app, period).pipe(provideAdminAutomationsLive)
  )
  if (outcome._tag === 'ValidationFailed') {
    console.error('[admin] automations overview response validation failed', outcome.error)
    return c.json(
      { success: false, message: 'Failed to build automations overview', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AUTOMATION_OVERVIEW_QUERIED,
    actor,
    resourceId: app.name,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}


async function handleListRuns(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedQuery = automationsRunsListQuerySchema.safeParse({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    status: c.req.query('status'),
    automationName: c.req.query('automationName'),
    automationId: c.req.query('automationId'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    include_deleted: c.req.query('include_deleted'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const query = parsedQuery.data

  if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
    return c.json({ success: false, message: 'from > to', code: 'BAD_REQUEST' }, 400)
  }

  const outcome = await Effect.runPromise(
    BuildAdminRunsList(app, {
      status: query.status,
      automationName: query.automationName,
      automationId: query.automationId,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
    }).pipe(provideAdminAutomationsLive)
  )
  if (outcome._tag === 'ValidationFailed') {
    console.error('[admin] automations runs list response validation failed', outcome.error)
    return c.json(
      { success: false, message: 'Failed to build runs list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AUTOMATION_RUNS_LIST_QUERIED,
    actor,
    resourceId: app.name,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}


async function handleRunDetail(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedParams = automationsRunsDetailParamsSchema.safeParse({
    runId: c.req.param('runId'),
  })
  if (!parsedParams.success) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  const { runId } = parsedParams.data

  const outcome = await Effect.runPromise(
    BuildAdminRunDetail(app, runId).pipe(provideAdminAutomationsLive)
  )

  if (outcome._tag === 'NotFound') {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  if (outcome._tag === 'ValidationFailed') {
    console.error('[admin] automations run detail response validation failed', outcome.error)
    return c.json(
      { success: false, message: 'Failed to build run detail', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AUTOMATION_RUNS_DETAIL_QUERIED,
    actor,
    resourceId: runId,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}


function retryErrorResponse(c: Context, error: ReplayAutomationRunError): Response {
  if (
    error._tag === 'AutomationNotFound' ||
    error._tag === 'AutomationRunNotFound' ||
    error._tag === 'AutomationRunMismatch'
  ) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  if (error._tag === 'AutomationRegistrySeedError') {
    return c.json(
      { success: false, message: 'Failed to register automation', code: 'INTERNAL_ERROR' },
      500
    )
  }
  return c.json({ success: false, message: 'Run not retryable', code: 'BAD_REQUEST' }, 400)
}

async function handleRetryRun(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedParams = automationsRunsDetailParamsSchema.safeParse({
    runId: c.req.param('runId'),
  })
  if (!parsedParams.success) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  const { runId } = parsedParams.data

  const options: RetryAutomationRunOptions = {
    runId,
    app,
    processEnv: process.env,
    userId: session.userId,
  }
  const result = await Effect.runPromise(
    Effect.either(provideAutomationLive(retryAutomationRun(options)))
  )
  if (result._tag === 'Left') {
    return retryErrorResponse(c, result.left)
  }

  return c.json({ runId: result.right.runId, status: 'accepted' }, 202)
}


export function chainAdminAutomationsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/admin/automations/overview', (c) => handleAutomationsOverview(c, resolveApp()))
    .post('/api/admin/automations/runs/:runId/retry', (c) => handleRetryRun(c, resolveApp()))
    .get('/api/admin/automations/runs/:runId', (c) => handleRunDetail(c, resolveApp()))
    .get('/api/admin/automations/runs', (c) => handleListRuns(c, resolveApp())) as T
}

export type { AutomationRunAdminItem }

