/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { buildEnvLookup } from '@/application/use-cases/automations/resolve-env-vars'
import { resolveTriggerInValue } from '@/application/use-cases/automations/resolve-trigger-data'
import { runWebhookAutomation } from '@/application/use-cases/automations/run-automation'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { provideAutomationLive } from './effect-runner'
import { runWebhookAuth } from './webhook-auth'
import { checkAndRecordDedup } from './webhook-dedup'
import { isRateLimited, normalizeRateLimit } from './webhook-rate-limit'
import { coerceQueryForSchema, validateAgainstSchema } from './webhook-validation'
import type { TriggerData } from '@/application/use-cases/automations/resolve-trigger-data'
import type { RunAutomationResult } from '@/application/use-cases/automations/run-automation'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'


type Trigger = NonNullable<App['automations']>[number]['trigger']
type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const METHODS: ReadonlyArray<Method> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const isMethod = (m: string): m is Method => (METHODS as ReadonlyArray<string>).includes(m)

const extractClientIp = (forwardedFor: string | undefined): string =>
  forwardedFor ? (forwardedFor.split(',')[0]?.trim() ?? '127.0.0.1') : '127.0.0.1'

const allowedMethodsFor = (trigger: Trigger): ReadonlyArray<Method> => {
  if (trigger.type !== 'webhook') return []
  const m = trigger.method
  return Array.isArray(m) ? (m as ReadonlyArray<Method>) : [m as Method]
}

const findWebhookAutomation = (app: App, name: string) => {
  const automation = app.automations?.find((a) => a.name === name)
  if (automation === undefined) return undefined
  if (automation.enabled === false) return undefined
  if (automation.trigger.type !== 'webhook') return undefined
  return automation
}

const headersToRecord = (req: Context['req']): Readonly<Record<string, string>> =>
  Object.fromEntries(req.raw.headers as unknown as Iterable<readonly [string, string]>)

const queryToRecord = (c: Context): Readonly<Record<string, string>> => {
  const queries = c.req.queries()
  return Object.fromEntries(
    Object.entries(queries).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? '') : (v ?? '')])
  )
}

const safeParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

const generateRunId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${String(Date.now())}-${String(Math.random()).slice(2, 10)}`
}


interface GateContext {
  readonly name: string
  readonly trigger: WebhookTrigger
  readonly method: Method
  readonly rawBody: string
  readonly envLookup: Readonly<Record<string, string>>
  readonly queryRecord: Readonly<Record<string, string>>
}
type GateResult =
  | { readonly status: 'pass'; readonly ctx: GateContext }
  | { readonly status: 'reject'; readonly response: Response }

const validateBodyAndQuery = (
  ctx: {
    readonly trigger: WebhookTrigger
    readonly body: unknown
    readonly queryRecord: Readonly<Record<string, string>>
  },
  c: Context
): Response | undefined => {
  if (ctx.trigger.requestSchema !== undefined) {
    const errors = validateAgainstSchema(ctx.body, ctx.trigger.requestSchema)
    if (errors.length > 0) return c.json({ error: 'validation_failed', errors }, 400)
  }
  if (ctx.trigger.querySchema !== undefined) {
    const coerced = coerceQueryForSchema(ctx.queryRecord, ctx.trigger.querySchema)
    const errors = validateAgainstSchema(coerced, ctx.trigger.querySchema)
    if (errors.length > 0) return c.json({ error: 'validation_failed', errors }, 400)
  }
  return undefined
}

const runRateLimitGate = (
  c: Context,
  name: string,
  trigger: WebhookTrigger
): Response | undefined => {
  if (trigger.rateLimit === undefined) return undefined
  const config = normalizeRateLimit(trigger.rateLimit)
  if (config === undefined) return undefined
  const ip = extractClientIp(c.req.header('x-forwarded-for'))
  const limit = isRateLimited(name, ip, config)
  return limit.limited
    ? c.json({ error: 'rate_limited' }, 429, { 'Retry-After': String(limit.retryAfter) })
    : undefined
}

const lookupAndMethodGate = (
  c: Context,
  app: App
):
  | { readonly status: 'reject'; readonly response: Response }
  | {
      readonly status: 'pass'
      readonly name: string
      readonly trigger: WebhookTrigger
      readonly method: Method
    } => {
  const name = c.req.param('name')
  if (name === undefined)
    return { status: 'reject', response: c.json({ error: 'invalid_request' }, 400) }
  const automation = findWebhookAutomation(app, name)
  if (automation === undefined)
    return { status: 'reject', response: c.json({ error: 'not_found' }, 404) }
  const trigger = automation.trigger as WebhookTrigger
  const allowed = allowedMethodsFor(trigger)
  const method = c.req.method.toUpperCase()
  if (!isMethod(method) || !allowed.includes(method)) {
    return { status: 'reject', response: c.json({ error: 'method_not_allowed', allowed }, 405) }
  }
  return { status: 'pass', name, trigger, method }
}

const runWebhookGates = async (c: Context, app: App): Promise<GateResult> => {
  const initial = lookupAndMethodGate(c, app)
  if (initial.status === 'reject') return initial
  const { name, trigger, method } = initial
  const rawBody = method === 'GET' ? '' : await c.req.text().catch(() => '')
  const envLookup = buildEnvLookup(app.env, process.env)
  if (!runWebhookAuth(c, trigger, rawBody, envLookup).ok) {
    return { status: 'reject', response: c.json({ error: 'unauthorized' }, 401) }
  }
  const rateLimited = runRateLimitGate(c, name, trigger)
  if (rateLimited !== undefined) return { status: 'reject', response: rateLimited }
  const body = rawBody === '' ? undefined : safeParseJson(rawBody)
  const queryRecord = queryToRecord(c)
  const validationError = validateBodyAndQuery({ trigger, body, queryRecord }, c)
  if (validationError !== undefined) return { status: 'reject', response: validationError }
  if (trigger.deduplicationKey !== undefined) {
    const triggerDataForDedup = {
      method,
      path: c.req.path,
      body,
      headers: headersToRecord(c.req),
      query: queryRecord,
      ip: extractClientIp(c.req.header('x-forwarded-for')),
    }
    const dedup = checkAndRecordDedup({
      automationName: name,
      trigger,
      triggerData: triggerDataForDedup,
    })
    if (dedup.isDuplicate) {
      return {
        status: 'reject',
        response: c.json({ success: true, deduplicated: true }, 200),
      }
    }
  }
  return { status: 'pass', ctx: { name, trigger, method, rawBody, envLookup, queryRecord } }
}

const buildTriggerData = (c: Context, gate: GateContext): TriggerData => ({
  method: gate.method,
  path: c.req.path,
  body: gate.rawBody === '' ? undefined : safeParseJson(gate.rawBody),
  headers: headersToRecord(c.req),
  query: gate.queryRecord,
  ip: extractClientIp(c.req.header('x-forwarded-for')),
})


interface BuildResponseInput {
  readonly trigger: WebhookTrigger
  readonly result: RunAutomationResult
  readonly triggerData: TriggerData
}

const toWebhookResponseStatus = (
  status: RunAutomationResult['status']
):
  | 'completed'
  | 'completed-with-errors'
  | 'failed'
  | 'skipped'
  | 'cancelled'
  | 'waiting-approval' => {
  if (status === 'success') return 'completed'
  if (status === 'completed-with-errors') return 'completed-with-errors'
  if (status === 'skipped') return 'skipped'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'waiting-approval') return 'waiting-approval'
  return 'failed'
}

const defaultSyncBody = (result: RunAutomationResult) => ({
  success: true,
  id: result.runId,
  status: toWebhookResponseStatus(result.status),
  ...(result.lastOutput !== undefined ? { output: result.lastOutput } : {}),
  ...(result.error !== undefined ? { error: result.error } : {}),
})

const responseFromAction = (actionResponse: Readonly<Record<string, unknown>>) => {
  const status =
    typeof actionResponse['status'] === 'number' ? (actionResponse['status'] as number) : 200
  const body = actionResponse['body'] ?? {}
  const headers =
    actionResponse['headers'] !== undefined
      ? (actionResponse['headers'] as Record<string, string>)
      : {}
  return { status, body, headers }
}

const buildSyncResponse = (input: BuildResponseInput) => {
  const { trigger, result, triggerData } = input
  if (result.responseOverride !== undefined) return responseFromAction(result.responseOverride)
  const cfg = trigger.response
  const status = cfg?.status ?? cfg?.statusCode ?? 200
  const context = { run: { id: result.runId }, trigger: { data: triggerData } }
  const body =
    cfg?.body !== undefined ? resolveTriggerInValue(cfg.body, context) : defaultSyncBody(result)
  const headers =
    cfg?.headers !== undefined
      ? (resolveTriggerInValue(cfg.headers, context) as Record<string, string>)
      : {}
  return { status, body, headers }
}


interface DispatchInput {
  readonly name: string
  readonly app: App
  readonly triggerData: TriggerData
  readonly userId?: string
}

const dispatchAsync = async (c: Context, input: DispatchInput): Promise<Response> => {
  let resolveRunId: ((id: string) => void) | undefined
  const runIdPromise = new Promise<string>((resolve) => {
    resolveRunId = resolve
  })

  const program = runWebhookAutomation({
    name: input.name,
    app: input.app,
    processEnv: process.env,
    triggerData: input.triggerData,
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    onPersisted: (id) => {
      if (resolveRunId !== undefined) {
        resolveRunId(id)
        resolveRunId = undefined
      }
    },
  })
  Effect.runPromise(Effect.either(provideAutomationLive(program))).then(
    (res) => {
      if (res._tag === 'Left') {
        console.error('[automation] async webhook run failed', res.left)
      }
      if (resolveRunId !== undefined) {
        resolveRunId(generateRunId())
        resolveRunId = undefined
      }
    },
    (err) => {
      console.error('[automation] async webhook run rejected', err)
      if (resolveRunId !== undefined) {
        resolveRunId(generateRunId())
        resolveRunId = undefined
      }
    }
  )
  const runId = await runIdPromise
  return c.json({ id: runId, runId }, 202)
}

const dispatchSync = async (
  c: Context,
  input: DispatchInput & { readonly trigger: WebhookTrigger }
): Promise<Response> => {
  const program = runWebhookAutomation({
    name: input.name,
    app: input.app,
    processEnv: process.env,
    triggerData: input.triggerData,
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
  })
  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))
  if (result._tag === 'Left') {
    if (result.left._tag === 'AutomationRegistrySeedError') {
      console.error('[automation] webhook dispatch failed: registry seed error', result.left)
      return c.json({ error: 'internal_error' }, 500)
    }
    return c.json({ error: 'not_found' }, 404)
  }
  const {
    status,
    body: respBody,
    headers,
  } = buildSyncResponse({
    trigger: input.trigger,
    result: result.right,
    triggerData: input.triggerData,
  })
  const cfg = input.trigger.response
  const operatorOverrodeStatus = cfg?.status !== undefined || cfg?.statusCode !== undefined
  const finalStatus = result.right.status === 'failure' && !operatorOverrodeStatus ? 500 : status
  return c.json(respBody as Record<string, unknown>, finalStatus as 200, headers)
}

export async function handleWebhookRequest(c: Context, app: App): Promise<Response> {
  const gate = await runWebhookGates(c, app)
  if (gate.status === 'reject') return gate.response

  const triggerData = buildTriggerData(c, gate.ctx)
  const session = getSessionContext(c)
  const userId = session?.userId

  if (gate.ctx.trigger.respondImmediately === true) {
    return dispatchAsync(c, {
      name: gate.ctx.name,
      app,
      triggerData,
      ...(userId !== undefined ? { userId } : {}),
    })
  }
  return dispatchSync(c, {
    trigger: gate.ctx.trigger,
    name: gate.ctx.name,
    app,
    triggerData,
    ...(userId !== undefined ? { userId } : {}),
  })
}
