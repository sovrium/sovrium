/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Effect, Either } from 'effect'
import {
  AutomationRunRepository,
  type PersistedRun,
  type PersistedStep,
} from '@/application/ports/repositories/automation-run-repository'
import { dispatchAutomationOnce } from '@/application/use-cases/automations/dispatch-automation-trigger'
import {
  replayAutomationRun,
  type ReplayAutomationRunError,
} from '@/application/use-cases/automations/replay-automation-run'
import {
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import {
  getAutomationRun,
  listAutomationRuns,
  type AutomationRunRecord,
} from '@/application/use-cases/automations/run-history-store'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { provideAutomationLive } from './effect-runner'
import { handleCancelRun, handleReplayRunById } from './runs-handlers'
import { handleWebhookRequest } from './webhook-handler'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

const triggerResultBody = (result: RunAutomationResult) => {
  const toPublicStatus = (
    s: RunAutomationResult['status']
  ): 'completed' | 'completed-with-errors' | 'failed' | 'skipped' | 'cancelled' => {
    if (s === 'success') return 'completed'
    if (s === 'completed-with-errors') return 'completed-with-errors'
    if (s === 'skipped') return 'skipped'
    if (s === 'cancelled') return 'cancelled'
    return 'failed'
  }
  return {
    success: true,
    id: result.runId,
    status: toPublicStatus(result.status),
    ...(result.lastOutput !== undefined ? { output: result.lastOutput } : {}),
    ...(result.error !== undefined ? { error: result.error } : {}),
  }
}

const computeCronNextRunOverlay = (
  trigger: Readonly<Record<string, unknown>>
): Record<string, string> => {
  if (trigger['type'] !== 'cron') return {}
  const expr = String(trigger['expression'])
  const tz = String(trigger['timezone'] ?? 'UTC')
  const zone = Either.try({
    try: () => DateTime.zoneUnsafeMakeNamed(tz),
    catch: () => undefined,
  })
  if (Either.isLeft(zone)) return {}
  const parsed = Cron.parse(expr, zone.right)
  if (Either.isLeft(parsed)) return {}
  return { nextRunAt: Cron.next(parsed.right, new Date()).toISOString() }
}

function handleListAutomations(c: Context, app: App) {
  const automations = (app.automations ?? []).map((automation) => {
    const trigger = automation.trigger as Record<string, unknown>
    const auth = trigger['auth'] as Record<string, unknown> | undefined
    const redactedAuth =
      auth === undefined
        ? undefined
        : {
            ...auth,
            ...(auth['token'] !== undefined ? { token: '[redacted]' } : {}),
            ...(auth['key'] !== undefined ? { key: '[redacted]' } : {}),
            ...(auth['secret'] !== undefined ? { secret: '[redacted]' } : {}),
            ...(auth['password'] !== undefined ? { password: '[redacted]' } : {}),
            ...(auth['username'] !== undefined ? { username: '[redacted]' } : {}),
          }
    const cronOverlay = computeCronNextRunOverlay(trigger)
    const redactedTrigger: Record<string, unknown> =
      redactedAuth === undefined
        ? { ...trigger, ...cronOverlay }
        : { ...trigger, auth: redactedAuth, ...cronOverlay }
    return {
      name: automation.name,
      enabled: automation.enabled ?? true,
      trigger: redactedTrigger,
    }
  })
  return c.json(automations, 200)
}

function manualTriggerErrorResponse(c: Context, error: RunAutomationError) {
  if (error._tag === 'AutomationNotFound' || error._tag === 'AutomationNotManualTriggered') {
    return c.json({ success: false, message: 'Automation not found' }, 404)
  }
  if (error._tag === 'AutomationManualRoleRequired') {
    return c.json(
      {
        success: false,
        message: 'Automation not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }
  if (error._tag === 'AutomationRegistrySeedError') {
    return c.json({ success: false, message: 'Failed to register automation in the database' }, 500)
  }
  return c.json({ success: false, message: 'Automation trigger is not manual' }, 400)
}

async function handleManualTrigger(c: Context, app: App) {
  const name = c.req.param('name')
  if (name === undefined) {
    return c.json({ success: false, message: 'Automation name required' }, 400)
  }

  const session = getSessionContext(c)
  const userRole = session?.userId !== undefined ? await getUserRole(session.userId) : undefined

  const body = await c.req.json().catch(() => undefined)

  const program = runManualAutomation({
    name,
    app,
    processEnv: process.env,
    userRole,
    triggerData: { body },
    ...(session?.userId !== undefined ? { userId: session.userId } : {}),
  })
  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))

  if (result._tag === 'Left') {
    return manualTriggerErrorResponse(c, result.left)
  }
  return c.json(triggerResultBody(result.right), 200)
}

const lookupTriggerType = (app: App, name: string): string =>
  app.automations?.find((a) => a.name === name)?.trigger.type ?? 'webhook'

const computeAttemptCount = (steps: ReadonlyArray<{ readonly output?: unknown }>): number => {
  const counts = steps
    .map(({ output }) => {
      if (output === null || output === undefined || typeof output !== 'object') return 0
      const { attempts } = output as { attempts?: unknown }
      return Array.isArray(attempts) ? attempts.length : 0
    })
    .filter((n) => n > 0)
  return counts.length === 0 ? 1 : Math.max(...counts)
}

const persistedRunToApi = (app: App, run: PersistedRun, steps?: ReadonlyArray<PersistedStep>) => ({
  id: run.id,
  automationName: run.automationName,
  status: run.status,
  triggerType: lookupTriggerType(app, run.automationName),
  triggerData: run.triggerData,
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  durationMs: run.durationMs,
  attempt: steps !== undefined ? computeAttemptCount(steps) : 1,
  error: run.error,
})

async function handleListRunsByName(c: Context, app: App) {
  const name = c.req.param('name')
  if (name === undefined) {
    return c.json({ success: false, message: 'Automation name required' }, 400)
  }

  const program = Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const runs = yield* repo.listByAutomationName(name)
    return yield* Effect.forEach(runs, (run) =>
      Effect.gen(function* () {
        const steps = yield* repo.findStepsByRunId(run.id)
        return buildDbRunDetailBody(app, run, steps)
      })
    )
  })

  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))
  if (result._tag === 'Right' && result.right.length > 0) {
    return c.json(result.right, 200)
  }

  const inMemoryRuns = listAutomationRuns({ automationName: name })
  const body = inMemoryRuns.map((run) => buildInMemoryRunDetailBody(app, run))
  return c.json(body, 200)
}

async function handleListRuns(c: Context, app: App) {
  const automationName = c.req.query('automationName')
  const status = c.req.query('status')
  const pageStr = c.req.query('page')
  const pageSizeStr = c.req.query('pageSize')
  const page = pageStr !== undefined ? Number(pageStr) : undefined
  const pageSize = pageSizeStr !== undefined ? Number(pageSizeStr) : undefined

  const program = Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* repo.listAll({
      ...(automationName !== undefined ? { automationName } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(page !== undefined ? { page } : {}),
      ...(pageSize !== undefined ? { pageSize } : {}),
    })
    const stepsPerRun = yield* Effect.forEach(result.runs, (run) => repo.findStepsByRunId(run.id))
    return { ...result, stepsPerRun }
  })

  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))
  if (result._tag === 'Right') {
    const { runs, total, stepsPerRun } = result.right
    const runsBody = {
      runs: runs.map((run, i) => persistedRunToApi(app, run, stepsPerRun[i])),
    }
    if (pageSize !== undefined) {
      const effectivePage = page !== undefined && page >= 1 ? page : 1
      const pagination = {
        page: effectivePage,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      }
      return c.json({ ...runsBody, pagination }, 200)
    }
    return c.json(runsBody, 200)
  }

  const runs = listAutomationRuns(automationName !== undefined ? { automationName } : undefined)
  return c.json({ runs }, 200)
}

const inMemoryStepStatusToApi = (
  status: 'success' | 'failure' | 'filtered' | 'skipped'
): string => {
  if (status === 'success') return 'completed'
  if (status === 'skipped') return 'skipped'
  if (status === 'filtered') return 'filtered'
  return 'failed'
}

const resolveTriggerType = (app: App, automationName: string): string =>
  app.automations?.find((a) => a.name === automationName)?.trigger.type ?? 'webhook'

const extractAttempts = (
  steps: ReadonlyArray<{ readonly output?: unknown; readonly status?: string }>
): ReadonlyArray<Readonly<Record<string, unknown>>> => {
  const lastWithAttempts = steps.findLast(
    (s) =>
      s.output !== undefined &&
      s.output !== null &&
      typeof s.output === 'object' &&
      Array.isArray((s.output as { attempts?: unknown }).attempts)
  )
  if (!lastWithAttempts) return []
  const out = lastWithAttempts.output as { readonly attempts: ReadonlyArray<unknown> }
  return out.attempts as ReadonlyArray<Readonly<Record<string, unknown>>>
}

const buildDbRunDetailBody = (app: App, run: PersistedRun, steps: readonly PersistedStep[]) => ({
  id: run.id,
  automationName: run.automationName,
  status: run.status,
  triggerType: resolveTriggerType(app, run.automationName),
  triggerData: run.triggerData,
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  durationMs: run.durationMs,
  attempt: 1,
  attempts: extractAttempts(steps),
  error: run.error,
  steps: steps.map((step) => ({
    name: step.actionName,
    type: '',
    status: step.status,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
    durationMs: step.durationMs,
    output: step.output ?? null,
    error: step.error,
  })),
})

const inMemoryRunStatusToApi = (status: AutomationRunRecord['status']): string => {
  if (status === 'success') return 'completed'
  if (status === 'failure') return 'failed'
  return status
}

const buildInMemoryRunDetailBody = (app: App, inMemoryRun: AutomationRunRecord) => ({
  id: inMemoryRun.id,
  automationName: inMemoryRun.automationName,
  status: inMemoryRunStatusToApi(inMemoryRun.status),
  triggerType: resolveTriggerType(app, inMemoryRun.automationName),
  triggerData: null,
  startedAt: inMemoryRun.startedAt,
  completedAt: inMemoryRun.finishedAt,
  durationMs: null,
  attempt: 1,
  attempts: extractAttempts(inMemoryRun.steps),
  error: inMemoryRun.error ?? null,
  steps: inMemoryRun.steps.map((step) => ({
    name: step.name,
    type: step.type,
    ...(step.operator !== undefined ? { operator: step.operator } : {}),
    status: inMemoryStepStatusToApi(step.status),
    startedAt: inMemoryRun.startedAt,
    completedAt: inMemoryRun.finishedAt,
    durationMs: null,
    output: step.output ?? null,
    error: step.error ?? null,
  })),
})

const loadDbRunDetail = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const run = yield* repo.findById(id)
    if (run === undefined) return undefined
    const steps = yield* repo.findStepsByRunId(id)
    return { run, steps }
  })

async function handleGetRunDetail(c: Context, app: App) {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }

  const dbResult = await Effect.runPromise(
    Effect.either(provideAutomationLive(loadDbRunDetail(id)))
  )
  if (dbResult._tag === 'Right' && dbResult.right !== undefined) {
    return c.json(buildDbRunDetailBody(app, dbResult.right.run, dbResult.right.steps), 200)
  }

  const inMemoryRun = getAutomationRun(id)
  if (inMemoryRun === undefined) {
    return c.json({ success: false, message: 'Run not found' }, 404)
  }
  return c.json(buildInMemoryRunDetailBody(app, inMemoryRun), 200)
}

async function handleFormAction(c: Context, app: App) {
  const name = c.req.param('name')
  if (name === undefined) {
    return c.json({ success: false, message: 'Automation name required' }, 400)
  }

  const automation = app.automations?.find((a) => a.name === name)
  if (automation === undefined) {
    return c.json({ success: false, message: 'Automation not found' }, 404)
  }

  const body = (await c.req.json().catch(() => ({}))) as { inputData?: Record<string, unknown> }
  const triggerData = { body: body.inputData ?? {} }
  const session = getSessionContext(c)

  const program = dispatchAutomationOnce({
    automation,
    app,
    processEnv: process.env,
    triggerData,
    userId: session?.userId,
  })

  const result = await Effect.runPromise(provideAutomationLive(program))
  if (result === undefined) {
    return c.json({ success: false, message: 'Automation dispatch failed' }, 500)
  }
  return c.json(triggerResultBody(result), 200)
}

function replayErrorResponse(c: Context, error: ReplayAutomationRunError) {
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

async function handleReplayRun(c: Context, app: App) {
  const name = c.req.param('name')
  const id = c.req.param('id')
  if (name === undefined || id === undefined) {
    return c.json({ success: false, message: 'Automation name and run id required' }, 400)
  }

  const body = (await c.req.json().catch(() => undefined)) as
    | { triggerData?: Record<string, unknown> }
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
  return c.json(triggerResultBody(result.right), 200)
}

export function chainAutomationRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .get('/api/automations', (c) => handleListAutomations(c, app))
    .on(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], '/api/automations/:name/webhook', (c) =>
      handleWebhookRequest(c, app)
    )
    .post('/api/automations/:name/trigger', (c) => handleManualTrigger(c, app))
    .post('/api/automations/:name/form-action', (c) => handleFormAction(c, app))
    .get('/api/automations/runs', (c) => handleListRuns(c, app))
    .get('/api/automations/runs/:id', (c) => handleGetRunDetail(c, app))
    .get('/api/automations/:name/runs', (c) => handleListRunsByName(c, app))
    .post('/api/automations/:name/runs/:id/replay', (c) => handleReplayRun(c, app))
    .post('/api/automations/runs/:id/replay', (c) => handleReplayRunById(c, app))
    .post('/api/automations/runs/:id/cancel', (c) => handleCancelRun(c, app)) as T
}
