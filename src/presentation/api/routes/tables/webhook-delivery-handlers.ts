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

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const findWebhook = (app: App, tableName: string, webhookName: string): Webhook | undefined => {
  const table = app.tables?.find((t) => t.name === tableName)
  return table?.webhooks?.find((w) => w.name === webhookName)
}

const parseLimit = (raw: string | undefined): number => {
  if (raw === undefined) return DEFAULT_LIMIT
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

const parseCursor = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

const parseStatus = (raw: string | undefined): 'success' | 'failed' | undefined =>
  raw === 'success' || raw === 'failed' ? raw : undefined

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

const findTableFields = (app: App, tableName: string): ReadonlyArray<SampleFieldShape> => {
  const table = app.tables?.find((t) => t.name === tableName)
  return (table?.fields ?? []) as ReadonlyArray<SampleFieldShape>
}

export async function handleTestWebhook(c: Context, app: App): Promise<Response> {
  const { tableName } = getTableContext(c)
  const webhookName = c.req.param('webhookName')!

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return c.json({ error: 'Webhook not found' }, 404)
  }

  const sampleRecord = buildSampleRecord(findTableFields(app, tableName))
  const result = await deliverTestWebhook({ webhook, tableName, sampleRecord })

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
