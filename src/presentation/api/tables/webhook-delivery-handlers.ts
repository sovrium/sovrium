/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { redactSecretHeaders } from '@/domain/kernel/sanitize/http-header-redaction'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { isAdminEquivalent } from '@/domain/models/app'
import { isFieldReadByNoOne } from '@/domain/models/app/tables/field-read-filter-service'
import { rebuildRetryPayload } from '@/domain/models/app/tables/webhooks/delivery-retry-service'
import {
  getDelivery,
  getDeliveryOutboxId,
  listDeliveries,
} from '@/infrastructure/webhooks/delivery-log-queries'
import { buildSampleRecord, type SampleFieldShape } from '@/infrastructure/webhooks/sample-record'
import { deliverAndLog, deliverTestWebhook } from '@/infrastructure/webhooks/table-webhook-dispatch'
import {
  errorBody,
  notFound as notFoundResponse,
  notFoundBody,
} from '@/presentation/api/runtime/auth-helpers'
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
  c.json(notFoundBody(`${what} not found`), 404)

/**
 * Gate every webhook management request on the caller being an admin.
 *
 * Managing a table's webhooks — the list, the delivery log, one delivery, a
 * retry and a test send — is an admin's, whatever the caller may do to the
 * table's records. A delivery row and the webhook list both carry the
 * configured URL (often with a token in it), and a retry or a test drives an
 * OUTBOUND request carrying the webhook's resolved credentials, so a table
 * grant is not enough to admit anyone here. `isAdminEquivalent` is the
 * canonical predicate, so a custom top role counts as the admin it is.
 *
 * Every other caller gets the exact 404 the table middleware answers for a
 * table that does not exist — same status, same body — and it is returned
 * before any webhook or delivery lookup and before any side effect (S1).
 */
export const denyUnlessWebhookAdmin = (c: Context, app: App): Response | undefined =>
  isAdminEquivalent(getTableContext(c).userRole, app) ? undefined : notFoundResponse(c)

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

  const denied = denyUnlessWebhookAdmin(c, app)
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

  const denied = denyUnlessWebhookAdmin(c, app)
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
 * POST /api/tables/:tableId/webhooks/:webhookName/deliveries/:deliveryId/retry
 *
 * Re-sends the original payload of a stored delivery. The retry produces a
 * NEW delivery-log entry (the original is left untouched as an audit record).
 */
export async function handleRetryDelivery(c: Context, app: App): Promise<Response> {
  const { tableName } = getTableContext(c)
  const webhookName = c.req.param('webhookName')!
  const deliveryIdRaw = c.req.param('deliveryId')!

  const denied = denyUnlessWebhookAdmin(c, app)
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

  // The stored envelope, re-read from its JSON text, under a fresh timestamp.
  const payload = rebuildRetryPayload({
    app,
    tableName: delivery.tableName,
    event: delivery.event,
    stored: delivery.payload,
    timestamp: new Date().toISOString(),
  })
  const outcome = await deliverAndLog({
    webhook,
    tableName,
    payload,
    appEnv: app.env,
    outboxDeliveryId: await getDeliveryOutboxId(deliveryId),
  })

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
  // A field no role may read is left out of a sample, as out of every payload.
  return ((table?.fields ?? []) as ReadonlyArray<SampleFieldShape>).filter(
    (field) => !isFieldReadByNoOne(app, tableName, field.name)
  )
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

  const denied = denyUnlessWebhookAdmin(c, app)
  if (denied) return denied

  const webhook = findWebhook(app, tableName, webhookName)
  if (webhook === undefined) {
    return notFound(c, 'Webhook')
  }

  const sampleRecord = buildSampleRecord(findTableFields(app, tableName))
  const result = await deliverTestWebhook({
    webhook,
    tableName,
    sampleRecord,
    appEnv: app.env,
  })

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
