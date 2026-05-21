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

type WebhookEvent = 'create' | 'update' | 'delete'

export interface TableWebhookPayload {
  readonly event: string
  readonly table: string
  readonly timestamp: string
  readonly data: CustomizedWebhookData
}

const isEnabled = (webhook: Webhook): boolean => webhook.enabled !== false

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
  readonly attemptCount?: number
  readonly retryStrategy?: string | undefined
}

const toNullableParams = (input: LogDeliveryInput) => ({
  httpStatus: input.httpStatus ?? null,
  error: input.error ?? null,
  responseBody: input.responseBody ?? null,
  retryStrategy: input.retryStrategy ?? null,
  attemptCount: Math.max(1, input.attemptCount ?? 1),
  isTest: input.isTest ?? false,
})

const logDelivery = async (input: LogDeliveryInput): Promise<number | undefined> => {
  const { webhookName, tableName, event, url, payload, requestHeaders } = input
  const { status, durationMs, requestedAt, completedAt } = input
  const p = toNullableParams(input)
  const result = await getDb().execute(sql`
    INSERT INTO public._webhook_deliveries
      (webhook_name, table_name, event, url, payload, request_headers, status,
       http_status, attempt_count, retry_strategy, error, response_body,
       duration_ms, requested_at, completed_at, is_test)
    VALUES (
      ${webhookName},
      ${tableName},
      ${event},
      ${url},
      ${JSON.stringify(payload)}::jsonb,
      ${JSON.stringify(requestHeaders)}::jsonb,
      ${status},
      ${p.httpStatus},
      ${p.attemptCount},
      ${p.retryStrategy},
      ${p.error},
      ${p.responseBody},
      ${Math.round(durationMs)},
      ${requestedAt}::timestamptz,
      ${completedAt}::timestamptz,
      ${p.isTest}
    )
    RETURNING id
  `)
  const id = rowsOf<Record<string, unknown>>(result)[0]?.['id']
  return typeof id === 'number' ? id : undefined
}

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'User-Agent': 'Sovrium-Webhook/1.0',
}

const DELIVERY_TIMEOUT_MS = 3000

interface DeliveryOutcomeFields {
  readonly requestHeaders: Record<string, string>
  readonly status: 'success' | 'failed'
  readonly httpStatus: number | undefined
  readonly error: string | undefined
  readonly responseBody: string | undefined
  readonly durationMs: number
}

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

const describeTransportError = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err)
  if (err instanceof Error && err.name === 'AbortError') {
    return `Webhook delivery timeout after ${DELIVERY_TIMEOUT_MS}ms`
  }
  if (/abort/i.test(raw)) return `Webhook delivery timeout: ${raw}`
  if (/fetch failed|unable to connect|econn|enotfound|ehostunreach|enetunreach/i.test(raw)) {
    return `Webhook delivery connection error: ${raw}`
  }
  return raw
}

const attemptDelivery = async (
  webhook: Webhook,
  payload: TableWebhookPayload
): Promise<DeliveryOutcomeFields> => {
  const body = JSON.stringify(payload)
  const authHeaders = await buildAuthHeaders(webhook, body)
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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

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

const deliverWithRetryAndLog = async (input: {
  readonly webhook: Webhook
  readonly tableName: string
  readonly payload: TableWebhookPayload
}): Promise<void> => {
  const { webhook, tableName, payload } = input
  const policy: ResolvedRetryPolicy = resolveRetryPolicy(webhook.retry)
  const requestedAt = new Date().toISOString()

  let outcome = await attemptDelivery(webhook, payload)
  let attempts = 1

  while (outcome.status === 'failed' && attempts <= policy.maxAttempts) {
    await sleep(computeRetryDelay(policy, attempts))
    outcome = await attemptDelivery(webhook, payload)
    attempts = attempts + 1
  }

  await logDelivery({
    webhookName: webhook.name,
    tableName,
    event: payload.event,
    url: webhook.url,
    payload,
    requestedAt,
    completedAt: new Date().toISOString(),
    attemptCount: attempts,
    retryStrategy: policy.maxAttempts > 0 ? policy.backoff : undefined,
    ...outcome,
  })
}

export interface TableWebhookTestPayload extends TableWebhookPayload {
  readonly test: true
}

export interface TestDeliveryResult {
  readonly success: boolean
  readonly httpStatus: number
  readonly duration: number
  readonly error: string | undefined
}

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

const dispatchOne = async (input: {
  readonly webhook: Webhook
  readonly tableName: string
  readonly event: WebhookEvent
  readonly record: Record<string, unknown>
  readonly previousRecord: Record<string, unknown> | undefined
}): Promise<void> => {
  const { webhook, tableName, event, record, previousRecord } = input
  const payload = buildPayload({ webhook, table: tableName, event, record, previousRecord })
  await deliverWithRetryAndLog({ webhook, tableName, payload })
}

export const triggerTableWebhooks = async (input: {
  readonly table: Table | undefined
  readonly event: WebhookEvent
  readonly record: Record<string, unknown>
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
    await Promise.all(
      matching.map((webhook) =>
        dispatchOne({ webhook, tableName: table.name, event, record, previousRecord })
      )
    )
  } catch {
  }
}
