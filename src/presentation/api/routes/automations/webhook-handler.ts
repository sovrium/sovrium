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

/**
 * Webhook trigger handler (T-1 / Wave 3).
 *
 * Single Hono dispatcher mounted for every supported HTTP method. The
 * handler:
 *   1. Resolves the automation by name and rejects disabled / non-webhook
 *      automations with 404 (no information leakage).
 *   2. Gates by allowed HTTP method (`405 method_not_allowed`).
 *   3. Runs the configured auth scheme (delegates to `webhook-auth.ts`).
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

type Trigger = NonNullable<App['automations']>[number]['trigger']
type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const METHODS: ReadonlyArray<Method> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const isMethod = (m: string): m is Method => (METHODS as ReadonlyArray<string>).includes(m)

/**
 * Best-effort client IP extraction. Inlined (rather than imported from
 * `infrastructure/server/route-setup/auth-route-utils`) so the presentation
 * layer doesn't reach into infrastructure — boundaries are enforced via
 * `eslint-plugin-boundaries`.
 */
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

// ── Gate stages ──────────────────────────────────────────────────────────────

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

/**
 * Synchronous lookup + method gate. Returns either the resolved trigger
 * context or a 4xx response — extracted so {@link runWebhookGates} stays
 * inside the `max-statements` budget.
 */
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
  // Deduplication gate. APP-AUTOMATION-RETRY-016: when the trigger declares
  // `deduplicationKey`, a second request that resolves to a key seen within
  // `deduplicationWindow` seconds is dropped silently (200 OK, no run row,
  // no side effects). Order matters — auth + rate-limit + schema validation
  // all run BEFORE dedup so a malformed duplicate doesn't poison the cache.
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

// ── Response building ────────────────────────────────────────────────────────

interface BuildResponseInput {
  readonly trigger: WebhookTrigger
  readonly result: RunAutomationResult
  readonly triggerData: TriggerData
}

/**
 * Default sync-webhook body shape. Mirrors the manual-trigger response built
 * by `triggerResultBody` in `routes/automations/index.ts` — both endpoints
 * return the same `RunAutomationResult` and must surface the same fields.
 *
 * Extracted from {@link buildSyncResponse} so the latter stays under the
 * project's complexity cap.
 */
/**
 * Map the engine's internal status to the public webhook-response status.
 * `'success'`/`'completed-with-errors'` are happy-path completions (the
 * latter records that some action failed but declared `continueOnError`);
 * `'failure'`/`'exhausted'`/`'timed-out'` collapse to `'failed'` so the
 * sync response stays binary-shaped. Callers wanting the richer status
 * label should read it off the runs API.
 */
const toWebhookResponseStatus = (
  status: RunAutomationResult['status']
): 'completed' | 'completed-with-errors' | 'failed' => {
  if (status === 'success') return 'completed'
  if (status === 'completed-with-errors') return 'completed-with-errors'
  return 'failed'
}

const defaultSyncBody = (result: RunAutomationResult) => ({
  success: true,
  id: result.runId,
  status: toWebhookResponseStatus(result.status),
  ...(result.lastOutput !== undefined ? { output: result.lastOutput } : {}),
  ...(result.error !== undefined ? { error: result.error } : {}),
})

/**
 * Translate a `webhook/response` action's `responseOverride` payload
 * (carried in `RunAutomationResult.responseOverride` — see A-10) into
 * the (status, body, headers) tuple the dispatcher returns. Templates
 * were already substituted in the action's props at dispatch time — this
 * helper just unwraps and types the values.
 */
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
  // A `webhook/response` action — when present — takes precedence over both
  // the trigger-level `response` config and the default sync body. The
  // handler has already substituted templates in its props (the run loop
  // does that before dispatch), so we just unwrap the override here.
  if (result.responseOverride !== undefined) return responseFromAction(result.responseOverride)
  const cfg = trigger.response
  const status = cfg?.status ?? cfg?.statusCode ?? 200
  const context = { run: { id: result.runId }, trigger: { data: triggerData } }
  // Default response surfaces `lastOutput` under `output` so code-action
  // results (and any future handlers that return data) are reachable from
  // the synchronous webhook response. When the operator configured a
  // `trigger.response.body`, we honour that instead — they explicitly
  // shaped the response.
  const body =
    cfg?.body !== undefined ? resolveTriggerInValue(cfg.body, context) : defaultSyncBody(result)
  const headers =
    cfg?.headers !== undefined
      ? (resolveTriggerInValue(cfg.headers, context) as Record<string, string>)
      : {}
  return { status, body, headers }
}

// ── Dispatchers ──────────────────────────────────────────────────────────────

interface DispatchInput {
  readonly name: string
  readonly app: App
  readonly triggerData: TriggerData
  readonly userId?: string
}

const dispatchAsync = (c: Context, input: DispatchInput): Response => {
  const runId = generateRunId()
  const program = runWebhookAutomation({
    name: input.name,
    app: input.app,
    processEnv: process.env,
    triggerData: input.triggerData,
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
  })
  // Fire-and-forget. The caller already received a 202 — log-only if the
  // background run rejects so operators can still detect dispatch crashes.
  Effect.runPromise(Effect.either(provideAutomationLive(program))).then(
    (res) => {
      if (res._tag === 'Left') {
        console.error('[automation] async webhook run failed', res.left)
      }
    },
    (err) => {
      console.error('[automation] async webhook run rejected', err)
    }
  )
  return c.json({ id: runId }, 202)
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
    // The pre-dispatch gate already filtered AutomationNotFound /
    // AutomationNotWebhookTriggered with 404 — by the time we reach here, a
    // Left can only come from the lazy registry seed (`AutomationRegistrySeedError`).
    // Surface that as 500 so operator dashboards / oncall paging treat it as
    // an outage rather than a missing automation.
    if (result.left._tag === 'AutomationRegistrySeedError') {
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
  // When the run failed and the operator did not configure a custom
  // `trigger.response.status`, escalate the HTTP status to 500. A failing
  // action (e.g. code action timeout, undeclared package access, sandbox
  // violation, record-create with missing data) means the side effects
  // the caller expected did not happen — returning 200 would mislead the
  // caller into thinking the work was committed. The 500 surface lets
  // monitoring / on-call see automation health via standard HTTP metrics.
  //
  // Operator override: when `trigger.response.status` is set explicitly,
  // we honour that — they have shaped the response and accept the
  // semantic of 200 even on partial failure.
  const cfg = input.trigger.response
  const operatorOverrodeStatus = cfg?.status !== undefined || cfg?.statusCode !== undefined
  const finalStatus = result.right.status === 'failure' && !operatorOverrodeStatus ? 500 : status
  return c.json(respBody as Record<string, unknown>, finalStatus as 200, headers)
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
