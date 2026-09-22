/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { redactSecretHeaders } from '@/domain/kernel/sanitize/http-header-redaction'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import {
  hasReadPermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
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
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
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

/** The canonical 404 these handlers return for BOTH absence and denial (S1). */
const notFound = (c: Context, what: string): Response =>
  c.json(errorBody({ error: `${what} not found`, code: ApiErrorCode.NOT_FOUND }), 404)

/**
 * Gate a delivery-log request on the TABLE's own permissions.
 *
 * Webhook-exists → 404 was the only gate these four endpoints had. A delivery
 * row carries the record payload verbatim, so a `viewer` on a
 * `read: ['admin']` table could read every record through the delivery log —
 * the table gate the records API applies, applied nowhere here.
 *
 * `read` governs the two GETs. Retry and test both drive an OUTBOUND request
 * carrying the webhook's resolved credentials, which is a side effect on the
 * table's behalf rather than a read, so they take `update`. A denial is a 404
 * either way: confirming the webhook exists is itself the enumeration this
 * endpoint must not offer.
 */
const denyUnlessPermitted = (c: Context, app: App, op: 'read' | 'update'): Response | undefined => {
  const { tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  const permitted =
    op === 'read'
      ? hasReadPermissionForRoles(table, effectiveRoles, app.tables)
      : hasUpdatePermissionForRoles(table, effectiveRoles, app.tables)
  return permitted ? undefined : notFound(c, 'Webhook')
}

/**
 * Redact the credential-bearing headers of a stored delivery row.
 *
 * `buildAuthHeaders` puts the webhook's RESOLVED plaintext secret into
 * `request_headers` — `Authorization: Bearer sk_live_…`, or an HMAC signature —
 * and `mapRow` returned that column verbatim. The sibling
 * `GET /api/tables/:tableId/webhooks` states in its own comment that "webhook
 * secrets are stripped from the response so auth credentials never leak"; this
 * is that contract, applied to the surface that actually held the secret.
 */
const redactDelivery = <T extends { readonly requestHeaders: unknown }>(delivery: T): T => ({
  ...delivery,
  requestHeaders: redactSecretHeaders(delivery.requestHeaders),
})

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

  const denied = denyUnlessPermitted(c, app, 'read')
  if (denied) return denied

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return notFound(c, 'Webhook')
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
      deliveries: result.deliveries.map(redactDelivery),
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

  const denied = denyUnlessPermitted(c, app, 'read')
  if (denied) return denied

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return notFound(c, 'Webhook')
  }

  const deliveryId = Number.parseInt(deliveryIdRaw, 10)
  if (Number.isNaN(deliveryId)) {
    return notFound(c, 'Delivery')
  }

  const delivery = await getDelivery({ tableName, webhookName, deliveryId })
  if (delivery === undefined) {
    return notFound(c, 'Delivery')
  }

  return c.json(redactDelivery(delivery), 200)
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

  const denied = denyUnlessPermitted(c, app, 'update')
  if (denied) return denied

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return notFound(c, 'Webhook')
  }

  const deliveryId = Number.parseInt(deliveryIdRaw, 10)
  if (Number.isNaN(deliveryId)) {
    return notFound(c, 'Delivery')
  }

  const delivery = await getDelivery({ tableName, webhookName, deliveryId })
  if (delivery === undefined) {
    return notFound(c, 'Delivery')
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

  const denied = denyUnlessPermitted(c, app, 'update')
  if (denied) return denied

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return notFound(c, 'Webhook')
  }

  const sampleRecord = buildSampleRecord(findTableFields(app, tableName))
  const result = await deliverTestWebhook({ webhook, tableName, sampleRecord })

  // A `httpStatus` of 0 means the request never reached the endpoint
  // (DNS/connection failure or SSRF-guard rejection) — surface a 502.
  if (result.httpStatus === 0) {
    return c.json(
      {
        ...errorBody({
          error: result.error ?? 'Webhook endpoint unreachable',
          code: ApiErrorCode.SERVICE_UNAVAILABLE,
        }),
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
