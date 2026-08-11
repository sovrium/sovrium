/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  getDelivery,
  listDeliveries,
  type DeliveryLogEntry,
} from '@/infrastructure/webhooks/delivery-log-queries'
import { buildSampleRecord, type SampleFieldShape } from '@/infrastructure/webhooks/sample-record'
import {
  deliverAndLog,
  deliverTestWebhook,
  type TableWebhookPayload,
} from '@/infrastructure/webhooks/table-webhook-dispatch'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Webhook } from '@/domain/models/app/tables/webhooks'
import type { Context } from 'hono'

/** Default page size for `GET /deliveries` when `?limit=` is omitted. */
const DEFAULT_LIMIT = 50
/** Hard cap on the page size to bound query cost. */
const MAX_LIMIT = 200

/**
 * Resolve the webhook declared on `tableName` with name `webhookName`.
 *
 * Returns `undefined` when the table or webhook does not exist — the caller
 * maps this to a 404 (anti-enumeration: the route itself was matched).
 */
const findWebhook = (app: App, tableName: string, webhookName: string): Webhook | undefined => {
  const table = app.tables?.find((t) => t.name === tableName)
  return table?.webhooks?.find((w) => w.name === webhookName)
}

/** Parse a positive integer query param, clamped to `[1, max]`, with a default. */
const parseLimit = (raw: string | undefined): number => {
  if (raw === undefined) return DEFAULT_LIMIT
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

/** Parse a numeric cursor query param; returns `undefined` when absent/invalid. */
const parseCursor = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** Parse the optional `?status=` filter; ignores unknown values. */
const parseStatus = (raw: string | undefined): 'success' | 'failed' | undefined =>
  raw === 'success' || raw === 'failed' ? raw : undefined

/**
 * GET /api/tables/:tableId/webhooks/:webhookName/deliveries
 *
 * Returns a paginated delivery-log history for a single table webhook,
 * newest-first, with `?limit`, `?cursor`, and `?status` query support.
 */
export async function handleListDeliveries(c: Context, app: App): Promise<Response> {
  const { tableName } = getTableContext(c)
  const webhookName = c.req.param('webhookName')!

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return c.json({ error: 'Webhook not found' }, 404)
  }

  const result = await listDeliveries({
    tableName,
    webhookName,
    limit: parseLimit(c.req.query('limit')),
    cursor: parseCursor(c.req.query('cursor')),
    status: parseStatus(c.req.query('status')),
  })

  return c.json(
    {
      deliveries: result.deliveries,
      totalCount: result.totalCount,
      ...(result.nextCursor === undefined ? {} : { nextCursor: result.nextCursor }),
    },
    200
  )
}

/**
 * GET /api/tables/:tableId/webhooks/:webhookName/deliveries/:deliveryId
 *
 * Returns the full detail (payload, headers, response body) for one delivery.
 */
export async function handleGetDelivery(c: Context, app: App): Promise<Response> {
  const { tableName } = getTableContext(c)
  const webhookName = c.req.param('webhookName')!
  const deliveryIdRaw = c.req.param('deliveryId')!

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return c.json({ error: 'Webhook not found' }, 404)
  }

  const deliveryId = Number.parseInt(deliveryIdRaw, 10)
  if (Number.isNaN(deliveryId)) {
    return c.json({ error: 'Delivery not found' }, 404)
  }

  const delivery = await getDelivery({ tableName, webhookName, deliveryId })
  if (delivery === undefined) {
    return c.json({ error: 'Delivery not found' }, 404)
  }

  return c.json(delivery, 200)
}

/**
 * Rebuild a webhook payload envelope from a stored delivery row.
 *
 * The stored `payload` already carries the canonical envelope shape; this
 * refreshes the `timestamp` so the retry is delivered as a fresh attempt.
 */
const rebuildPayload = (delivery: DeliveryLogEntry): TableWebhookPayload => {
  const stored = (delivery.payload ?? {}) as Partial<TableWebhookPayload>
  const record =
    stored.data && typeof stored.data === 'object'
      ? ((stored.data as { record?: Record<string, unknown> }).record ?? {})
      : {}
  return {
    event: typeof stored.event === 'string' ? stored.event : delivery.event,
    table: typeof stored.table === 'string' ? stored.table : delivery.tableName,
    timestamp: new Date().toISOString(),
    data: { record },
  }
}

/**
 * POST /api/tables/:tableId/webhooks/:webhookName/deliveries/:deliveryId/retry
 *
 * Re-sends the original payload of a stored delivery. The retry produces a
 * NEW delivery-log entry (the original is left untouched as an audit record).
 */
export async function handleRetryDelivery(c: Context, app: App): Promise<Response> {
  const { tableName } = getTableContext(c)
  const webhookName = c.req.param('webhookName')!
  const deliveryIdRaw = c.req.param('deliveryId')!

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return c.json({ error: 'Webhook not found' }, 404)
  }

  const deliveryId = Number.parseInt(deliveryIdRaw, 10)
  if (Number.isNaN(deliveryId)) {
    return c.json({ error: 'Delivery not found' }, 404)
  }

  const delivery = await getDelivery({ tableName, webhookName, deliveryId })
  if (delivery === undefined) {
    return c.json({ error: 'Delivery not found' }, 404)
  }

  const payload = rebuildPayload(delivery)
  const outcome = await deliverAndLog({ webhook, tableName, payload })

  return c.json(
    {
      success: outcome.success,
      ...(outcome.deliveryId === undefined ? {} : { deliveryId: String(outcome.deliveryId) }),
    },
    200
  )
}

/**
 * Resolve a table's declared fields by name, narrowed to the
 * {@link SampleFieldShape} slice the sample-record generator reads (empty
 * array when the table is absent).
 */
const findTableFields = (app: App, tableName: string): ReadonlyArray<SampleFieldShape> => {
  const table = app.tables?.find((t) => t.name === tableName)
  return (table?.fields ?? []) as ReadonlyArray<SampleFieldShape>
}

/**
 * POST /api/tables/:tableId/webhooks/:webhookName/test
 *
 * Sends a one-off `webhook.test` payload to a configured webhook so a
 * developer can verify connectivity before relying on it in production. The
 * payload carries `test: true` and synthetic sample data matching the table's
 * field structure; the webhook's auth config is honoured. The attempt is
 * recorded in `_webhook_deliveries` tagged as a test delivery.
 *
 * Returns 200 with `{ success, httpStatus, duration }` when the endpoint
 * responded (regardless of its status code), and 502 with
 * `{ success: false, error }` when the endpoint was unreachable.
 */
export async function handleTestWebhook(c: Context, app: App): Promise<Response> {
  const { tableName } = getTableContext(c)
  const webhookName = c.req.param('webhookName')!

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return c.json({ error: 'Webhook not found' }, 404)
  }

  const sampleRecord = buildSampleRecord(findTableFields(app, tableName))
  const result = await deliverTestWebhook({ webhook, tableName, sampleRecord })

  // A `httpStatus` of 0 means the request never reached the endpoint
  // (DNS/connection failure or SSRF-guard rejection) — surface a 502.
  if (result.httpStatus === 0) {
    return c.json(
      {
        success: false,
        error: result.error ?? 'Webhook endpoint unreachable',
        duration: result.duration,
      },
      502
    )
  }

  return c.json(
    {
      success: result.success,
      httpStatus: result.httpStatus,
      duration: result.duration,
      ...(result.error === undefined ? {} : { error: result.error }),
    },
    200
  )
}
