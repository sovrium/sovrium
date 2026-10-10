/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TemplateEngine, type TemplateRenderer } from '@/application/ports/services/template-engine'
import { loadPausedAutomationNames } from '@/application/use-cases/automations/paused-automation-names'
import { buildEnvLookup } from '@/application/use-cases/automations/resolve-env-vars'
import { runWebhookAutomation } from '@/application/use-cases/automations/run-automation'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { triggerOfType } from '@/domain/models/app/automations/trigger-entries-service'
import { logError } from '@/infrastructure/logging/logger'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { getRequestClientIp, getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { headersToRecord, recordedHeaders, runWebhookAuth } from './webhook-auth'
import { resolveWebhookCaller, sessionWebhookRefuses } from './webhook-caller'
import { checkAndRecordDedup } from './webhook-dedup'
import { allowedMethodsFor, isMethod, type Method, type Trigger } from './webhook-methods'
import { isRateLimited, normalizeRateLimit } from './webhook-rate-limit'
import {
  webhookInvalidRequest,
  webhookMethodNotAllowed,
  webhookNotFound,
  webhookRateLimited,
  webhookRegistrySeedFailure,
  webhookUnauthorized,
  webhookValidationFailed,
} from './webhook-refusals'
import { buildSyncResponse } from './webhook-sync-response'
import { coerceQueryForSchema, validateAgainstSchema } from './webhook-validation'
import { answerVerificationHandshake } from './webhook-verification'
import { webhookJson } from './webhook-wire-json'
import type {
  TriggerData,
  TriggerRequester,
} from '@/application/use-cases/automations/resolve-trigger-data'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Webhook trigger handler.
 *
 * Single Hono dispatcher mounted for every supported HTTP method. The
 * handler:
 *   1. Resolves the automation by name and rejects disabled / non-webhook
 *      automations with 404 (no information leakage).
 *   2. Gates by allowed HTTP method (`405 method_not_allowed`).
 *   3. Runs the configured auth scheme (`webhook-auth.ts`; `session` in `webhook-caller.ts`).
 *   4. Enforces optional per-IP rate limiting (delegates to
 *      `webhook-rate-limit.ts`).
 *   5. Validates body / query against optional JSON-Schema-like shapes
 *      (delegates to `webhook-validation.ts`).
 *   6. Builds the public `trigger.data` (method/path/body/headers/query/ip)
 *      and dispatches to the existing `runWebhookAutomation` Effect program.
 *   7. Returns 202 Accepted on `respondImmediately: true`, otherwise
 *      synthesises a response from `trigger.response` (status / headers /
 *      body) with `{{run.id}}` and `{{trigger.data.X}}` template support.
 *
 * Protocol concerns (auth, rate-limit, schema validation, HTTP shape) live
 * here; execution concerns stay in `application/use-cases/automations/*`.
 */

type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

/**
 * Resolve the webhook automation behind `:name`, or `undefined` for anything
 * the router must treat as non-existent.
 *
 * THIS GATE IS LOAD-BEARING FOR ANTI-ENUMERATION, not a duplicate of the
 * downstream resolver in `run-automation.ts`. It runs inside
 * {@link lookupAndMethodGate}, which {@link runWebhookGates} calls BEFORE the
 * auth gate and BEFORE rate limiting. If the off-state check here read only
 * `enabled`, a PAUSED automation would fall through to auth and answer `401`
 * to a bad secret, while a CONFIG-DISABLED one answers `404` without auth ever
 * being attempted — an oracle telling an attacker the automation exists and is
 * merely paused (S1; an automation pause spec pins both to 404).
 */
const findWebhookAutomation = (app: App, name: string, pausedNames: ReadonlySet<string>) => {
  const automation = app.automations?.find((a) => a.name === name)
  if (automation === undefined) return undefined
  if (!isAutomationOperationallyEnabled(automation, pausedNames)) return undefined
  // The webhook ENTRY, with its own auth; never another entry of the automation.
  // A protocol entry answers only at its protocol's paths (telemetry-ingest-handler.ts).
  const trigger = triggerOfType(automation, 'webhook')
  return trigger?.protocol === undefined ? trigger : undefined
}

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

// ── Gate stages ──────────────────────────────────────────────────────────────

interface GateContext {
  readonly name: string
  readonly trigger: WebhookTrigger
  readonly method: Method
  readonly rawBody: string
  readonly envLookup: Readonly<Record<string, string>>
  readonly queryRecord: Readonly<Record<string, string>>
  readonly caller: TriggerRequester | undefined
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
    if (errors.length > 0) return webhookValidationFailed(c, 'body', errors)
  }
  if (ctx.trigger.querySchema !== undefined) {
    const coerced = coerceQueryForSchema(ctx.queryRecord, ctx.trigger.querySchema)
    const errors = validateAgainstSchema(coerced, ctx.trigger.querySchema)
    if (errors.length > 0) return webhookValidationFailed(c, 'query', errors)
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
  const ip = getRequestRateLimitKey(c)
  const limit = isRateLimited(name, ip, config)
  return limit.limited ? webhookRateLimited(c, limit.retryAfter) : undefined
}

/**
 * Synchronous lookup + method gate. Returns either the resolved trigger
 * context or a 4xx response — extracted so {@link runWebhookGates} stays
 * inside the `max-statements` budget.
 */
const lookupAndMethodGate = (
  c: Context,
  app: App,
  pausedNames: ReadonlySet<string>
):
  | { readonly status: 'reject'; readonly response: Response }
  | {
      readonly status: 'pass'
      readonly name: string
      readonly trigger: WebhookTrigger
      readonly method: Method
    } => {
  const name = c.req.param('name')
  if (name === undefined) return { status: 'reject', response: webhookInvalidRequest(c) }
  const trigger = findWebhookAutomation(app, name, pausedNames)
  if (trigger === undefined) return { status: 'reject', response: webhookNotFound(c) }
  const allowed = allowedMethodsFor(trigger)
  const handshake = answerVerificationHandshake(c, app, trigger, allowed.includes('GET'))
  if (handshake !== undefined) return { status: 'reject', response: handshake }
  const method = c.req.method.toUpperCase()
  if (!isMethod(method) || !allowed.includes(method)) {
    return { status: 'reject', response: webhookMethodNotAllowed(c, method, allowed) }
  }
  return { status: 'pass', name, trigger, method }
}

/** The template engine this request's server holds (the `TemplateEngine` port). */
const readTemplateEngine = (c: Context): Promise<TemplateRenderer> =>
  runDomainPromise(c, TemplateEngine.use(Effect.succeed))

/**
 * Deduplication gate: when the trigger declares `deduplicationKey`, a second
 * request resolving to a key seen within `deduplicationWindow` seconds is
 * dropped silently (200 OK, no run row, no side effects). Auth, rate limit and
 * schema validation all run BEFORE it so a malformed duplicate cannot poison
 * the cache.
 */
const runDedupGate = async (
  c: Context,
  input: Pick<GateContext, 'name' | 'trigger' | 'method' | 'queryRecord'> & {
    readonly body: unknown
  }
): Promise<Response | undefined> => {
  if (input.trigger.deduplicationKey === undefined) return undefined
  const dedup = checkAndRecordDedup({
    automationName: input.name,
    trigger: input.trigger,
    triggerData: {
      method: input.method,
      path: c.req.path,
      body: input.body,
      headers: headersToRecord(c.req),
      query: input.queryRecord,
      ip: getRequestClientIp(c),
    },
    templates: await readTemplateEngine(c),
  })
  return dedup.isDuplicate ? c.json({ success: true, deduplicated: true }, 200) : undefined
}

const runWebhookGates = async (c: Context, app: App): Promise<GateResult> => {
  // The operational-pause read has to happen HERE, before the lookup gate, so
  // the paused and config-disabled off-states are decided at the same point in
  // the chain — i.e. before auth can turn one of them into a 401.
  const pausedNames = await runDomainPromise(c, loadPausedAutomationNames)
  const initial = lookupAndMethodGate(c, app, pausedNames)
  if (initial.status === 'reject') return initial
  const { name, trigger, method } = initial
  const caller = await resolveWebhookCaller(c, app)
  if (sessionWebhookRefuses(trigger, app, caller)) {
    return { status: 'reject', response: webhookNotFound(c) }
  }
  const rawBody = method === 'GET' ? '' : await c.req.text().catch(() => '')
  const envLookup = buildEnvLookup(app.env, process.env)
  if (!runWebhookAuth(c, trigger, rawBody, envLookup).ok) {
    return { status: 'reject', response: webhookUnauthorized(c) }
  }
  const rateLimited = runRateLimitGate(c, name, trigger)
  if (rateLimited !== undefined) return { status: 'reject', response: rateLimited }
  const body = rawBody === '' ? undefined : safeParseJson(rawBody)
  const queryRecord = queryToRecord(c)
  const validationError = validateBodyAndQuery({ trigger, body, queryRecord }, c)
  if (validationError !== undefined) return { status: 'reject', response: validationError }
  const duplicate = await runDedupGate(c, { name, trigger, method, body, queryRecord })
  if (duplicate !== undefined) return { status: 'reject', response: duplicate }
  return {
    status: 'pass',
    ctx: { name, trigger, method, rawBody, envLookup, queryRecord, caller },
  }
}

/** What a run keeps of the request: auth, caller and dedup read the live one before this. */
const buildTriggerData = (c: Context, gate: GateContext): TriggerData => ({
  method: gate.method,
  path: c.req.path,
  body: gate.rawBody === '' ? undefined : safeParseJson(gate.rawBody),
  headers: recordedHeaders(c.req, gate.trigger),
  query: gate.queryRecord,
  ip: getRequestClientIp(c),
  ...(gate.caller === undefined ? {} : { requester: gate.caller }),
})

// ── Dispatchers ──────────────────────────────────────────────────────────────

interface DispatchInput {
  readonly name: string
  readonly app: App
  readonly triggerData: TriggerData
  readonly userId?: string
}

const dispatchAsync = async (c: Context, input: DispatchInput): Promise<Response> => {
  // The scheduler persists the run row synchronously at queue time and
  // exposes the resulting DB-generated UUID via the `onPersisted` callback.
  // We park here on a Promise that resolves the moment that callback fires
  // so the 202 response carries the SAME id the cancel endpoint can find
  // Fallback to a synthetic id if the engine
  // never invokes the callback (e.g. an unexpected rejection before
  // persistQueuedRun runs).
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
  // Fire-and-forget. The caller already received a 202 — log-only if the
  // background run rejects so operators can still detect dispatch crashes.
  Effect.runPromise(Effect.result(provideDomain(c, program))).then(
    (res) => {
      if (res._tag === 'Failure') {
        logError('[automation] async webhook run failed', res.failure)
      }
      // If persistQueuedRun never fired the callback (engine errored
      // before queueing), unblock the response with a synthetic id so
      // the 202 still returns.
      if (resolveRunId !== undefined) {
        resolveRunId(generateRunId())
        resolveRunId = undefined
      }
    },
    (err) => {
      logError('[automation] async webhook run rejected', err)
      if (resolveRunId !== undefined) {
        resolveRunId(generateRunId())
        resolveRunId = undefined
      }
    }
  )
  const runId = await runIdPromise
  // Surface as BOTH `id` (the sync response's key) AND `runId` (the runs API's).
  return webhookJson(c, { id: runId, runId }, 202)
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
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (result._tag === 'Failure') {
    // The pre-dispatch gate already filtered AutomationNotFound /
    // AutomationNotWebhookTriggered with 404 — by the time we reach here, a
    // Left can only come from the lazy registry seed (`AutomationRegistrySeedError`).
    // Surface that as 500 so operator dashboards / oncall paging treat it as
    // an outage rather than a missing automation.
    if (result.failure._tag === 'AutomationRegistrySeedError') {
      logError('[automation] webhook dispatch failed: registry seed error', result.failure)
      return webhookRegistrySeedFailure(c)
    }
    return webhookNotFound(c)
  }
  const {
    status,
    body: respBody,
    headers,
  } = buildSyncResponse({
    trigger: input.trigger,
    result: result.success,
    triggerData: input.triggerData,
    templates: await readTemplateEngine(c),
  })
  // A failed run answers 500: the side effects the caller expected did not
  // happen, and monitoring reads automation health off HTTP status. Not when
  // the operator set `trigger.response.status` (they shaped the answer), nor
  // when an error `flow/stop` ended the run — the automation chose that failure
  // and its answer (the stop's, or an earlier `webhook/response`) stands.
  const cfg = input.trigger.response
  const operatorOverrodeStatus = cfg?.status !== undefined || cfg?.statusCode !== undefined
  const chosen = operatorOverrodeStatus || result.success.stopped === true
  const finalStatus = result.success.status === 'failure' && !chosen ? 500 : status
  return webhookJson(c, respBody, finalStatus, headers)
}

/**
 * Dispatch a webhook request. Mounted by `chainAutomationRoutes` for every
 * supported HTTP method — the handler does the per-trigger filtering inside
 * so a single 405 response can advertise the configured `allowed` list.
 */
export async function handleWebhookRequest(c: Context, app: App): Promise<Response> {
  const gate = await runWebhookGates(c, app)
  if (gate.status === 'reject') return gate.response

  const triggerData = buildTriggerData(c, gate.ctx)
  const userId = gate.ctx.caller?.id

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
