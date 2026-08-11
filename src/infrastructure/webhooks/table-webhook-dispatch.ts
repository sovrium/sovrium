/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import {
  computeRetryDelay,
  customizeWebhookData,
  resolveRetryPolicy,
  type CustomizedWebhookData,
  type ResolvedRetryPolicy,
  type Webhook,
} from '@/domain/models/app/tables/webhooks'
import { getDb } from '@/infrastructure/database/drizzle/db-bun'
import { buildAuthHeaders } from './auth-headers'
import { rowsOf } from './delivery-log-queries'
import { deliverWebhook } from './dispatcher'
import type { Table } from '@/domain/models/app/tables'

/** CRUD events a table webhook can subscribe to. */
type WebhookEvent = 'create' | 'update' | 'delete'

/**
 * The payload delivered to a table webhook. Mirrors the standard webhook
 * envelope: an `event` discriminator (`record.<event>`), the originating
 * `table` name, an ISO `timestamp`, and a `data` block carrying the record.
 *
 * The `data` block is shaped by the webhook's `payload` customization config:
 * it always carries `record`, and may additionally carry `previousValues` and
 * `changedFields` on update events when `includePreviousValues` is enabled.
 */
export interface TableWebhookPayload {
  readonly event: string
  readonly table: string
  readonly timestamp: string
  readonly data: CustomizedWebhookData
}

/**
 * A webhook is active unless `enabled` is explicitly `false`. Omitting the
 * field (the schema makes it optional) means the webhook fires — the
 * default-true contract.
 */
const isEnabled = (webhook: Webhook): boolean => webhook.enabled !== false

/**
 * Build the JSON request body for a webhook delivery, applying the webhook's
 * `payload` customization (field selection, metadata, previous-value
 * tracking). The record's `id` plus its (possibly filtered) field values are
 * surfaced under `data.record`, flattened so receivers read
 * `data.record.<column>` directly.
 */
const buildPayload = (input: {
  readonly webhook: Webhook
  readonly table: string
  readonly event: WebhookEvent
  readonly record: Record<string, unknown>
  readonly previousRecord: Record<string, unknown> | undefined
}): TableWebhookPayload => {
  const { webhook, table, event, record, previousRecord } = input
  return {
    event: `record.${event}`,
    table,
    timestamp: new Date().toISOString(),
    data: customizeWebhookData({ record, payload: webhook.payload, event, previousRecord }),
  }
}

interface LogDeliveryInput {
  readonly webhookName: string
  readonly tableName: string
  readonly event: string
  readonly url: string
  readonly payload: TableWebhookPayload
  readonly requestHeaders: Record<string, string>
  readonly status: 'success' | 'failed'
  readonly httpStatus: number | undefined
  readonly error: string | undefined
  readonly responseBody: string | undefined
  readonly durationMs: number
  readonly requestedAt: string
  readonly completedAt: string
  readonly isTest?: boolean
  /** Total delivery attempts made (initial + retries). Defaults to 1. */
  readonly attemptCount?: number
  /** Retry backoff strategy in effect (NULL when no retry policy applied). */
  readonly retryStrategy?: string | undefined
}

/**
 * Append a row to `public._webhook_deliveries`. Best-effort — a logging
 * failure must never mask a successful record mutation, so the caller wraps
 * this in a swallowing catch.
 *
 * Returns the inserted row id so callers (e.g. the manual-retry handler) can
 * reference the freshly created delivery log entry.
 */
/**
 * Resolve the nullable `_webhook_deliveries` columns from a delivery input.
 *
 * SQL NULL is represented by the JS `null` literal in Drizzle's `sql`
 * template — `undefined` does not bind as a parameter value — so each
 * optional field is coalesced to `null` here (`unicorn/no-null` disabled).
 */
/* eslint-disable unicorn/no-null */
const toNullableParams = (input: LogDeliveryInput) => ({
  httpStatus: input.httpStatus ?? null,
  error: input.error ?? null,
  responseBody: input.responseBody ?? null,
  retryStrategy: input.retryStrategy ?? null,
  attemptCount: Math.max(1, input.attemptCount ?? 1),
  isTest: input.isTest ?? false,
})
/* eslint-enable unicorn/no-null */

const logDelivery = async (input: LogDeliveryInput): Promise<number | undefined> => {
  const { webhookName, tableName, event, url, payload, requestHeaders } = input
  const { status, durationMs, requestedAt, completedAt } = input
  const p = toNullableParams(input)
  // Dialect-aware: bare `_webhook_deliveries` (no `public.` qualifier) works
  // on both dialects — PG's `public` is the default search-path schema.
  // The PG-only `::jsonb` and `::timestamptz` casts are dropped: Drizzle's
  // parameter binding handles the type-coercion under PG, and the SQLite
  // mirror stores `payload`/`request_headers` as `text(mode:'json')` and
  // `requested_at`/`completed_at` as INTEGER `timestamp_ms`. The plain bound
  // values land in both schemas without an explicit cast — and the casts
  // crash SQLite at the `::` parser token.
  const result = await getDb().execute(sql`
    INSERT INTO _webhook_deliveries
      (webhook_name, table_name, event, url, payload, request_headers, status,
       http_status, attempt_count, retry_strategy, error, response_body,
       duration_ms, requested_at, completed_at, is_test)
    VALUES (
      ${webhookName},
      ${tableName},
      ${event},
      ${url},
      ${JSON.stringify(payload)},
      ${JSON.stringify(requestHeaders)},
      ${status},
      ${p.httpStatus},
      ${p.attemptCount},
      ${p.retryStrategy},
      ${p.error},
      ${p.responseBody},
      ${Math.round(durationMs)},
      ${requestedAt},
      ${completedAt},
      ${p.isTest}
    )
    RETURNING id
  `)
  const id = rowsOf<Record<string, unknown>>(result)[0]?.['id']
  return typeof id === 'number' ? id : undefined
}

/** Base headers always sent with a delivery, before any auth headers. */
const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'User-Agent': 'Sovrium-Webhook/1.0',
}

/**
 * Hard timeout for a single table-webhook delivery attempt, in milliseconds.
 *
 * Shorter than the 30s default so an unreachable or non-responsive upstream
 * fails fast enough for the retry policy to run several attempts within the
 * caller's request budget (table-webhook dispatch is awaited synchronously
 * on the record-mutation response path).
 */
const DELIVERY_TIMEOUT_MS = 3000

/** The result-derived fields persisted to a delivery-log row. */
interface DeliveryOutcomeFields {
  readonly requestHeaders: Record<string, string>
  readonly status: 'success' | 'failed'
  readonly httpStatus: number | undefined
  readonly error: string | undefined
  readonly responseBody: string | undefined
  readonly durationMs: number
}

/**
 * Interpret a {@link deliverWebhook} result envelope into the subset of
 * delivery-log fields it determines. `expectedHeaders` is the fallback header
 * set used when the transport did not echo the actual headers sent.
 */
const outcomeFromResult = (
  result: Record<string, unknown>,
  expectedHeaders: Record<string, string>
): DeliveryOutcomeFields => {
  const ok = result['success'] === true
  const sentHeaders = result['requestHeaders']
  return {
    requestHeaders:
      sentHeaders && typeof sentHeaders === 'object'
        ? (sentHeaders as Record<string, string>)
        : expectedHeaders,
    status: ok ? 'success' : 'failed',
    httpStatus: typeof result['statusCode'] === 'number' ? result['statusCode'] : undefined,
    error: ok ? undefined : String(result['error'] ?? `http_${result['statusCode']}`),
    responseBody: typeof result['responseBody'] === 'string' ? result['responseBody'] : undefined,
    durationMs: typeof result['duration'] === 'number' ? result['duration'] : 0,
  }
}

/**
 * Describe a webhook transport failure with a stable, human-readable reason.
 *
 * Folds the various low-level failure shapes — `AbortError` from the hard
 * timeout, DNS/connection failures from `fetch` — into a message that names
 * the failure class (`timeout`, `connection`) so delivery-log consumers can
 * categorise it without inspecting framework-specific error text.
 */
const describeTransportError = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err)
  // The hard timeout aborts the request via AbortController; Bun surfaces
  // this as an AbortError whose message does not mention "timeout".
  if (err instanceof Error && err.name === 'AbortError') {
    return `Webhook delivery timeout after ${DELIVERY_TIMEOUT_MS}ms`
  }
  if (/abort/i.test(raw)) return `Webhook delivery timeout: ${raw}`
  // DNS / TCP failures (`fetch failed`, `Unable to connect`, ECONN*, etc.)
  // are normalised to mention "connection" so consumers can categorise them.
  if (/fetch failed|unable to connect|econn|enotfound|ehostunreach|enetunreach/i.test(raw)) {
    return `Webhook delivery connection error: ${raw}`
  }
  return raw
}

/**
 * Perform a single webhook delivery over the wire (no logging).
 *
 * Auth headers are recomputed per attempt over the exact body string.
 * Transport failures (SSRF guard, timeout, connection refused) are folded
 * into a synthetic failure envelope so the outcome path stays branch-free.
 */
const attemptDelivery = async (
  webhook: Webhook,
  payload: TableWebhookPayload
): Promise<DeliveryOutcomeFields> => {
  const body = JSON.stringify(payload)
  const authHeaders = await buildAuthHeaders(webhook, body)
  // The header set we expect to send — base headers plus any auth headers.
  // `deliverWebhook` echoes the actual set back; we fall back to this if it
  // does not (e.g. transport failure before headers are assembled).
  const expectedHeaders = { ...BASE_HEADERS, 'X-Webhook-Event': payload.event, ...authHeaders }
  const result = await deliverWebhook(
    webhook.url,
    payload.event,
    payload as unknown as Record<string, unknown>,
    { extraHeaders: authHeaders, timeoutMs: DELIVERY_TIMEOUT_MS }
  ).catch((err: unknown) => ({
    success: false,
    error: describeTransportError(err),
  }))
  return outcomeFromResult(result, expectedHeaders)
}

/** Sleep for `ms` milliseconds. Used to space out webhook retry attempts. */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    // eslint-disable-next-line functional/no-expression-statements -- schedule the timer that resolves the sleep
    setTimeout(resolve, ms)
  })

/**
 * Deliver a webhook for a pre-built payload and record the attempt in
 * `_webhook_deliveries`. Used by the manual delivery-retry handler — delivers
 * the exact payload exactly once over the wire and persists a single
 * delivery-log row.
 *
 * Returns the inserted delivery-log row id (when logging succeeds) so the
 * retry handler can surface it.
 *
 * @public
 */
export const deliverAndLog = async (input: {
  readonly webhook: Webhook
  readonly tableName: string
  readonly payload: TableWebhookPayload
}): Promise<{ readonly deliveryId: number | undefined; readonly success: boolean }> => {
  const { webhook, tableName, payload } = input
  const requestedAt = new Date().toISOString()
  const outcome = await attemptDelivery(webhook, payload)
  const deliveryId = await logDelivery({
    webhookName: webhook.name,
    tableName,
    event: payload.event,
    url: webhook.url,
    payload,
    requestedAt,
    completedAt: new Date().toISOString(),
    ...outcome,
  })
  return { deliveryId, success: outcome.status === 'success' }
}

/**
 * Deliver a webhook for a pre-built payload, applying the webhook's retry
 * policy on failure, then record a single delivery-log row carrying the
 * FINAL outcome and the total `attempt_count`.
 *
 * The retry policy ({@link resolveRetryPolicy}) governs how many extra
 * attempts follow the initial delivery and the backoff between them. A 2xx
 * response stops retrying immediately; any failure (4xx/5xx, transport error,
 * timeout) triggers the next attempt until `maxAttempts` retries are
 * exhausted. `maxAttempts: 0` disables retries entirely (a single attempt).
 */
const deliverWithRetryAndLog = async (input: {
  readonly webhook: Webhook
  readonly tableName: string
  readonly payload: TableWebhookPayload
}): Promise<void> => {
  const { webhook, tableName, payload } = input
  const policy: ResolvedRetryPolicy = resolveRetryPolicy(webhook.retry)
  const requestedAt = new Date().toISOString()

  // Initial delivery (attempt 1), then up to `maxAttempts` retries. A 2xx
  // stops the loop; the loop also stops once retries are exhausted.
  // eslint-disable-next-line functional/no-let -- accumulator for the retry loop
  let outcome = await attemptDelivery(webhook, payload)
  // eslint-disable-next-line functional/no-let -- attempt counter for the retry loop
  let attempts = 1

  /* eslint-disable functional/no-loop-statements, functional/no-expression-statements -- sequential retry loop with backoff and accumulators */
  while (outcome.status === 'failed' && attempts <= policy.maxAttempts) {
    await sleep(computeRetryDelay(policy, attempts))
    outcome = await attemptDelivery(webhook, payload)
    attempts = attempts + 1
  }
  /* eslint-enable functional/no-loop-statements, functional/no-expression-statements */

  // eslint-disable-next-line functional/no-expression-statements -- DB side effect: persist the final delivery row
  await logDelivery({
    webhookName: webhook.name,
    tableName,
    event: payload.event,
    url: webhook.url,
    payload,
    requestedAt,
    completedAt: new Date().toISOString(),
    attemptCount: attempts,
    // `retry_strategy` records the backoff in effect only when retries are
    // actually enabled (maxAttempts > 0); a no-retry webhook leaves it NULL.
    retryStrategy: policy.maxAttempts > 0 ? policy.backoff : undefined,
    ...outcome,
  })
}

/**
 * The envelope delivered by a webhook test (ping). Mirrors
 * {@link TableWebhookPayload} but carries the `webhook.test` event type and a
 * top-level `test: true` flag so a receiver can identify and discard it.
 */
export interface TableWebhookTestPayload extends TableWebhookPayload {
  readonly test: true
}

/** Outcome of {@link deliverTestWebhook}, surfaced by the test endpoint. */
export interface TestDeliveryResult {
  readonly success: boolean
  readonly httpStatus: number
  readonly duration: number
  readonly error: string | undefined
}

/**
 * Deliver a one-off test payload to a webhook and record it in
 * `_webhook_deliveries` as a test delivery (`is_test = true`).
 *
 * The payload uses the `webhook.test` event type and carries `test: true` at
 * the top level so the receiver can identify it. The webhook's `auth` config
 * is honoured (signature/key/bearer headers are applied) so the test
 * exercises the exact delivery path a real event would take. Unlike record
 * events, the test delivery makes a single attempt with no retry.
 *
 * @public
 */
export const deliverTestWebhook = async (input: {
  readonly webhook: Webhook
  readonly tableName: string
  readonly sampleRecord: Record<string, unknown>
}): Promise<TestDeliveryResult> => {
  const { webhook, tableName, sampleRecord } = input
  const payload: TableWebhookTestPayload = {
    event: 'webhook.test',
    table: tableName,
    timestamp: new Date().toISOString(),
    test: true,
    data: { record: sampleRecord },
  }
  const requestedAt = new Date().toISOString()
  const outcome = await attemptDelivery(webhook, payload)
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect: persist the test delivery row
  await logDelivery({
    webhookName: webhook.name,
    tableName,
    event: 'webhook.test',
    url: webhook.url,
    payload,
    requestedAt,
    completedAt: new Date().toISOString(),
    isTest: true,
    ...outcome,
  })
  return {
    success: outcome.status === 'success',
    httpStatus: outcome.httpStatus ?? 0,
    duration: Math.round(outcome.durationMs),
    error: outcome.error,
  }
}

/**
 * Deliver a single webhook (applying its retry policy) and record the final
 * attempt in `_webhook_deliveries`. The webhook's `payload` customization is
 * applied while building the request body.
 */
const dispatchOne = async (input: {
  readonly webhook: Webhook
  readonly tableName: string
  readonly event: WebhookEvent
  readonly record: Record<string, unknown>
  readonly previousRecord: Record<string, unknown> | undefined
}): Promise<void> => {
  const { webhook, tableName, event, record, previousRecord } = input
  const payload = buildPayload({ webhook, table: tableName, event, record, previousRecord })
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect: deliver with retry + log
  await deliverWithRetryAndLog({ webhook, tableName, payload })
}

/**
 * Fire all enabled webhooks declared on `table` that subscribe to `event`.
 *
 * Table webhooks are syntactic sugar over automations — this dispatcher is
 * the runtime that delivers each one and logs the attempt. Disabled webhooks
 * (`enabled: false`) are skipped without a delivery row.
 *
 * Fire-and-forget: every failure (transport error, logging error) is
 * swallowed so a webhook problem can never turn a successful record
 * create/update/delete into an HTTP error for the caller.
 *
 * @public
 */
export const triggerTableWebhooks = async (input: {
  readonly table: Table | undefined
  readonly event: WebhookEvent
  readonly record: Record<string, unknown>
  /**
   * The pre-update record values, used to populate `previousValues` and
   * `changedFields` for webhooks with `payload.includePreviousValues`. Only
   * meaningful for `'update'` events; ignored otherwise.
   */
  readonly previousRecord?: Record<string, unknown> | undefined
}): Promise<void> => {
  const { table, event, record, previousRecord } = input
  if (!table) return
  const webhooks = table.webhooks ?? []
  const matching = webhooks.filter(
    (webhook) => isEnabled(webhook) && webhook.events.includes(event)
  )
  if (matching.length === 0) return

  try {
    // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget delivery dispatch
    await Promise.all(
      matching.map((webhook) =>
        dispatchOne({ webhook, tableName: table.name, event, record, previousRecord })
      )
    )
  } catch {
    // Fire-and-forget: webhook failures never surface to the caller.
  }
}
