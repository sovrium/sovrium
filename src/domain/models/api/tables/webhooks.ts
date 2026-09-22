/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

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
  'webhook.test',
]).annotate({ description: 'Event type that triggered the webhook delivery' })

/**
 * Delivery status for webhook attempts.
 */
export const webhookDeliveryStatusSchema = Schema.Literals([
  'success',
  'failed',
  'pending',
  'retrying',
]).annotate({ description: 'Current delivery status' })

// ---------------------------------------------------------------------------
// Delivery log schemas
// ---------------------------------------------------------------------------

/**
 * A single webhook delivery log entry.
 *
 * Used for:
 * - GET /api/tables/:tableName/webhooks/:webhookName/deliveries (list view)
 * - OpenAPI documentation generation
 */
export const webhookDeliverySchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Unique delivery identifier' }),
  webhookName: Schema.String.annotate({ description: 'Name of the webhook that was triggered' }),
  event: webhookEventSchema,
  status: webhookDeliveryStatusSchema,
  httpStatus: Schema.NullOr(
    Schema.Int.annotate({ description: 'HTTP response status code (null if no response)' })
  ),
  attemptCount: Schema.Int.annotate({ description: 'Number of delivery attempts' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(1))
  ),
  requestedAt: looseIsoDateTime({
    description: 'ISO 8601 timestamp when the delivery was initiated',
  }),
  completedAt: Schema.NullOr(
    looseIsoDateTime({
      description: 'ISO 8601 timestamp when the delivery completed (null if still pending)',
    })
  ),
  duration: Schema.NullOr(
    Schema.Finite.annotate({
      description: 'Response time in milliseconds (null if no response received)',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  ),
  error: Schema.NullOr(
    Schema.String.annotate({ description: 'Error message if the delivery failed' })
  ),
})

/**
 * Full delivery details including request and response payloads.
 *
 * Used for:
 * - GET /api/tables/:tableName/webhooks/:webhookName/deliveries/:deliveryId
 */
export const webhookDeliveryDetailSchema = Schema.Struct({
  ...webhookDeliverySchema.fields,
  requestHeaders: Schema.Record(Schema.String, Schema.String).annotate({
    description: 'HTTP headers sent with the webhook request',
  }),
  requestBody: Schema.String.annotate({ description: 'JSON payload sent to the webhook endpoint' }),
  responseHeaders: Schema.NullOr(
    Schema.Record(Schema.String, Schema.String).annotate({
      description: 'HTTP response headers (null if no response)',
    })
  ),
  responseBody: Schema.NullOr(
    Schema.String.annotate({
      description: 'Response body from the webhook endpoint (null if no response)',
    })
  ),
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
  nextCursor: Schema.NullOr(
    Schema.String.annotate({ description: 'Cursor for the next page (null if no more results)' })
  ),
  totalCount: Schema.Int.annotate({ description: 'Total number of matching deliveries' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
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
  deliveryId: Schema.String.annotate({
    description: 'ID of the new delivery log entry created for the retry',
  }),
  status: Schema.Literal('pending').annotate({
    description: 'Initial status of the retry delivery',
  }),
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
  httpStatus: Schema.NullOr(
    Schema.Int.annotate({
      description: 'HTTP response status code from the endpoint (null if unreachable)',
    })
  ),
  duration: Schema.Finite.annotate({ description: 'Round-trip time in milliseconds' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  responseBody: Schema.NullOr(
    Schema.String.annotate({
      description: 'Response body from the webhook endpoint (null if unreachable)',
    })
  ),
  error: Schema.NullOr(
    Schema.String.annotate({ description: 'Error message if the test delivery failed' })
  ),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type WebhookEvent = typeof webhookEventSchema.Type
export type WebhookDeliveryStatus = typeof webhookDeliveryStatusSchema.Type
export type WebhookDelivery = typeof webhookDeliverySchema.Type
export type WebhookDeliveryDetail = typeof webhookDeliveryDetailSchema.Type
export type ListDeliveriesQuery = typeof listDeliveriesQuerySchema.Type
export type ListDeliveriesResponse = typeof listDeliveriesResponseSchema.Type
export type RetryDeliveryResponse = typeof retryDeliveryResponseSchema.Type
export type TestWebhookResponse = typeof testWebhookResponseSchema.Type
