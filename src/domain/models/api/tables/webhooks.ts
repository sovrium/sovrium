/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { describedUnknown } from '@/domain/kernel/config-parsing/described-ref'
import { looseIsoDateTime } from '@/domain/kernel/config-parsing/formats'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/**
 * Webhook event types that trigger deliveries.
 */
export const webhookEventSchema = Schema.Literals([
  'record.create',
  'record.update',
  'record.delete',
  'record.restore',
  'webhook.test',
]).annotate({ description: 'Event type that triggered the webhook delivery' })

/**
 * The status a stored delivery reads as: the log records exactly these two.
 */
export const webhookDeliveryStatusSchema = Schema.Literals(['success', 'failed']).annotate({
  description: 'How the delivery ended',
})

// ---------------------------------------------------------------------------
// Delivery log schemas
// ---------------------------------------------------------------------------

/**
 * One webhook delivery log entry, whole: the list and the single read answer
 * the same row, secret request headers redacted.
 *
 * Used for:
 * - GET /api/tables/:tableName/webhooks/:webhookName/deliveries
 * - GET /api/tables/:tableName/webhooks/:webhookName/deliveries/:deliveryId
 */
export const webhookDeliverySchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Unique delivery identifier' }),
  webhookName: Schema.String.annotate({ description: 'Name of the webhook that was triggered' }),
  tableName: Schema.String.annotate({ description: 'Name of the table the event happened on' }),
  event: webhookEventSchema,
  url: Schema.String.annotate({ description: 'The address the delivery was sent to' }),
  status: webhookDeliveryStatusSchema,
  httpStatus: optionalField(
    Schema.Int.annotate({ description: 'HTTP response status code; absent when none came back' })
  ),
  attemptCount: Schema.Int.annotate({ description: 'Number of delivery attempts' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(1))
  ),
  error: optionalField(
    Schema.String.annotate({ description: 'Error message if the delivery failed' })
  ),
  responseBody: optionalField(
    Schema.String.annotate({
      description: 'Response body from the webhook endpoint; absent when none came back',
    })
  ),
  duration: Schema.Finite.annotate({
    description: 'Response time in milliseconds; 0 when none was measured',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  requestedAt: looseIsoDateTime({
    description: 'ISO 8601 timestamp when the delivery was initiated',
  }),
  completedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp when the delivery completed' }),
  payload: describedUnknown('The payload sent to the webhook endpoint'),
  requestHeaders: describedUnknown('HTTP headers sent with the request, secret values redacted'),
})

// ---------------------------------------------------------------------------
// Delivery list query and response schemas
// ---------------------------------------------------------------------------

/**
 * Query parameters for listing webhook deliveries.
 */
export const listDeliveriesQuerySchema = Schema.Struct({
  status: optionalField(
    Schema.Literals(['all', 'success', 'failed']).annotate({
      description: 'Filter deliveries by status (defaults to all)',
    })
  ),
  limit: optionalField(
    Schema.String.annotate({ description: 'Maximum number of deliveries to return' })
  ),
  cursor: optionalField(
    Schema.String.annotate({ description: 'Cursor for pagination (delivery ID to start after)' })
  ),
})

/**
 * Paginated response for webhook delivery logs.
 */
export const listDeliveriesResponseSchema = Schema.Struct({
  deliveries: Schema.Array(webhookDeliverySchema).annotate({
    description: 'List of delivery log entries',
  }),
  totalCount: Schema.Int.annotate({ description: 'Total number of matching deliveries' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  nextCursor: optionalField(
    Schema.String.annotate({ description: 'Cursor for the next page; absent on the last page' })
  ),
})

// ---------------------------------------------------------------------------
// Retry delivery schema
// ---------------------------------------------------------------------------

/**
 * Response for manually retrying a failed delivery.
 *
 * Used for:
 * - POST /api/tables/:tableName/webhooks/:webhookName/deliveries/:deliveryId/retry
 */
export const retryDeliveryResponseSchema = Schema.Struct({
  success: Schema.Boolean.annotate({
    description: 'Whether the endpoint accepted the re-sent payload',
  }),
  deliveryId: optionalField(
    Schema.String.annotate({
      description: 'ID of the new delivery log entry created for the retry, when it was logged',
    })
  ),
})

// ---------------------------------------------------------------------------
// Test webhook schema
// ---------------------------------------------------------------------------

/**
 * Response for testing a webhook endpoint.
 *
 * Used for:
 * - POST /api/tables/:tableName/webhooks/:webhookName/test
 */
export const testWebhookResponseSchema = Schema.Struct({
  success: Schema.Boolean.annotate({
    description: 'Whether the test payload was delivered successfully',
  }),
  httpStatus: Schema.Int.annotate({ description: 'HTTP response status code from the endpoint' }),
  duration: Schema.Finite.annotate({ description: 'Round-trip time in milliseconds' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  error: optionalField(
    Schema.String.annotate({ description: 'Error message if the test delivery failed' })
  ),
})

// ---------------------------------------------------------------------------
// Configured webhooks and the delivery sweep
// ---------------------------------------------------------------------------

/**
 * `GET /api/tables/:tableId/webhooks`: the table's webhooks, never their
 * credentials.
 */
export const listWebhooksResponseSchema = Schema.Struct({
  webhooks: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({ description: 'The webhook name' }),
      url: Schema.String.annotate({ description: 'The address deliveries are sent to' }),
      events: Schema.Array(Schema.String).annotate({
        description: 'The record events the webhook fires on',
      }),
      enabled: Schema.Boolean.annotate({ description: 'Whether the webhook fires' }),
    })
  ).annotate({ description: 'The webhooks the table declares' }),
})

/**
 * `POST /api/internal/webhooks/deliver-due`: what one sweep of the outbox did.
 */
export const webhookOutboxSweepResponseSchema = Schema.Struct({
  delivered: Schema.Array(Schema.String).annotate({ description: 'Deliveries that went through' }),
  retrying: Schema.Array(Schema.String).annotate({
    description: 'Deliveries that failed and will be tried again',
  }),
  dead: Schema.Array(Schema.String).annotate({
    description: 'Deliveries that used their last attempt',
  }),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** @public */
export type ListWebhooksResponse = typeof listWebhooksResponseSchema.Type
/** @public */
export type WebhookOutboxSweepResponse = typeof webhookOutboxSweepResponseSchema.Type
export type WebhookEvent = typeof webhookEventSchema.Type
export type WebhookDeliveryStatus = typeof webhookDeliveryStatusSchema.Type
export type WebhookDelivery = typeof webhookDeliverySchema.Type
export type ListDeliveriesQuery = typeof listDeliveriesQuerySchema.Type
export type ListDeliveriesResponse = typeof listDeliveriesResponseSchema.Type
export type RetryDeliveryResponse = typeof retryDeliveryResponseSchema.Type
export type TestWebhookResponse = typeof testWebhookResponseSchema.Type
