/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TemplateEngine } from '@/application/ports/services/template-engine'
import { loadPausedAutomationNames } from '@/application/use-cases/automations/paused-automation-names'
import { buildEnvLookup } from '@/application/use-cases/automations/resolve-env-vars'
import { webhookDeduplicatedResponseSchema } from '@/domain/models/api/automations/automations'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { triggerOfType } from '@/domain/models/app/automations/trigger-entries-service'
import { getRequestClientIp, getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { presentsApiKeyOnly } from '@/presentation/api/middleware/request-credential'
import { answerFailures, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import { refuseFullQueue } from './webhook-admission'
import { headersToRecord, recordedHeaders, runWebhookAuth } from './webhook-auth'
import { resolveWebhookCaller, sessionWebhookRefuses } from './webhook-caller'
import { checkAndRecordDedup } from './webhook-dedup'
import { dispatchAsync, dispatchSync, type DispatchInput } from './webhook-dispatch'
import { allowedMethodsFor, isMethod, type Method, type Trigger } from './webhook-methods'
import { isRateLimited, webhookBudgetOf } from './webhook-rate-limit'
import {
  webhookInvalidRequest,
  webhookMethodNotAllowed,
  webhookNotFound,
  webhookRateLimited,
  webhookUnauthorized,
  webhookValidationFailed,
} from './webhook-refusals'
import { webhookActsAsSystem } from './webhook-sync-response'
import { coerceQueryForSchema, validateAgainstSchema } from './webhook-validation'
import { answerVerificationHandshake } from './webhook-verification'
import type {
  TriggerData,
  TriggerRequester,
} from '@/application/use-cases/automations/resolve-trigger-data'
import type { App } from '@/domain/models/app'
import type { DomainServices } from '@/infrastructure/logging/request-effect'
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
 *   4. Enforces per-IP budgets (`webhook-rate-limit.ts`) and the queue
 *      bound (`webhook-admission.ts`).
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
type WebhookGateFailure =
  | Effect.Error<typeof loadPausedAutomationNames>
  | Effect.Error<ReturnType<typeof resolveWebhookCaller>>
  | Effect.Error<ReturnType<typeof refuseFullQueue>>
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
  const config = webhookBudgetOf(trigger)
  if (config === undefined) return undefined
  const ip = getRequestRateLimitKey(c)
  const limit = isRateLimited(trigger, name, ip, config)
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

/**
 * Deduplication gate: when the trigger declares `deduplicationKey`, a second
 * request resolving to a key seen within `deduplicationWindow` seconds is
 * dropped silently (200 OK, no run row, no side effects). Auth, rate limit and
 * schema validation all run BEFORE it so a malformed duplicate cannot poison
 * the cache.
 */
const runDedupGate = (
  c: Context,
  input: Pick<GateContext, 'name' | 'trigger' | 'method' | 'queryRecord'> & {
    readonly body: unknown
  }
) =>
  Effect.gen(function* () {
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
      templates: yield* TemplateEngine,
    })
    return dedup.isDuplicate
      ? shapedJson(c, { success: true, deduplicated: true }, webhookDeduplicatedResponseSchema)
      : undefined
  })

const runWebhookGates = (c: Context, app: App) =>
  Effect.gen(function* (): Effect.fn.Return<GateResult, WebhookGateFailure, DomainServices> {
    // The operational-pause read has to happen HERE, before the lookup gate, so
    // the paused and config-disabled off-states are decided at the same point in
    // the chain — i.e. before auth can turn one of them into a 401.
    const pausedNames = yield* loadPausedAutomationNames
    const initial = lookupAndMethodGate(c, app, pausedNames)
    if (initial.status === 'reject') return initial
    const { name, trigger, method } = initial
    const caller = yield* resolveWebhookCaller(c, app, trigger)
    if (sessionWebhookRefuses(trigger, app, caller)) {
      return { status: 'reject', response: webhookNotFound(c) }
    }
    const rawBody =
      method === 'GET'
        ? ''
        : // effect-promise: total -- a body that cannot be read is read as none.
          yield* Effect.promise(() => c.req.text().catch(() => ''))
    const envLookup = buildEnvLookup(app.env, process.env)
    if (!runWebhookAuth(c, trigger, rawBody, envLookup).ok) {
      return { status: 'reject', response: webhookUnauthorized(c) }
    }
    const rateLimited = runRateLimitGate(c, name, trigger) ?? (yield* refuseFullQueue(c, name))
    if (rateLimited !== undefined) return { status: 'reject', response: rateLimited }
    const body = rawBody === '' ? undefined : safeParseJson(rawBody)
    const queryRecord = queryToRecord(c)
    const validationError = validateBodyAndQuery({ trigger, body, queryRecord }, c)
    if (validationError !== undefined) return { status: 'reject', response: validationError }
    const duplicate = yield* runDedupGate(c, { name, trigger, method, body, queryRecord })
    if (duplicate !== undefined) return { status: 'reject', response: duplicate }
    return {
      status: 'pass',
      ctx: { name, trigger, method, rawBody, envLookup, queryRecord, caller },
    }
  })

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

/**
 * Dispatch a webhook request. Mounted by `chainAutomationRoutes` for every
 * supported HTTP method — the handler does the per-trigger filtering inside
 * so a single 405 response can advertise the configured `allowed` list.
 */
export function handleWebhookRequest(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(c, answerFailures(c, webhookResponse(c, app)))
}

/** Gate, dispatch and answer one webhook request, as one program. */
const webhookResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const gate = yield* runWebhookGates(c, app)
    if (gate.status === 'reject') return gate.response

    const { trigger, caller } = gate.ctx
    const input: DispatchInput = {
      name: gate.ctx.name,
      app,
      triggerData: buildTriggerData(c, gate.ctx),
      ...(caller !== undefined ? { userId: caller.id } : {}),
      actsAsSystem: webhookActsAsSystem(trigger, presentsApiKeyOnly(c)),
    }
    return trigger.respondImmediately === true
      ? // effect-promise: total -- settles on the run's id, or a stand-in when the run never queued.
        yield* Effect.promise(() => dispatchAsync(c, input))
      : yield* dispatchSync(c, { ...input, trigger })
  })
