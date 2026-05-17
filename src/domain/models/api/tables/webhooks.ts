/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/**
 * Webhook event types that trigger deliveries.
 */
export const webhookEventSchema = z
  .enum(['record.create', 'record.update', 'record.delete', 'webhook.test'])
  .describe('Event type that triggered the webhook delivery')

/**
 * Delivery status for webhook attempts.
 */
export const webhookDeliveryStatusSchema = z
  .enum(['success', 'failed', 'pending', 'retrying'])
  .describe('Current delivery status')

// ---------------------------------------------------------------------------
// Delivery log schemas (US-TABLES-WEBHOOKS-005)
// ---------------------------------------------------------------------------

/**
 * A single webhook delivery log entry.
 *
 * Used for:
 * - GET /api/tables/:tableName/webhooks/:webhookName/deliveries (list view)
 * - OpenAPI documentation generation
 */
export const webhookDeliverySchema = z.object({
  id: z.string().describe('Unique delivery identifier'),
  webhookName: z.string().describe('Name of the webhook that was triggered'),
  event: webhookEventSchema,
  status: webhookDeliveryStatusSchema,
  httpStatus: z
    .number()
    .int()
    .nullable()
    .describe('HTTP response status code (null if no response)'),
  attemptCount: z.number().int().min(1).describe('Number of delivery attempts'),
  requestedAt: z.string().datetime().describe('ISO 8601 timestamp when the delivery was initiated'),
  completedAt: z
    .string()
    .datetime()
    .nullable()
    .describe('ISO 8601 timestamp when the delivery completed (null if still pending)'),
  duration: z
    .number()
    .min(0)
    .nullable()
    .describe('Response time in milliseconds (null if no response received)'),
  error: z.string().nullable().describe('Error message if the delivery failed'),
})

/**
 * Full delivery details including request and response payloads.
 *
 * Used for:
 * - GET /api/tables/:tableName/webhooks/:webhookName/deliveries/:deliveryId
 */
export const webhookDeliveryDetailSchema = webhookDeliverySchema.extend({
  requestHeaders: z
    .record(z.string(), z.string())
    .describe('HTTP headers sent with the webhook request'),
  requestBody: z.string().describe('JSON payload sent to the webhook endpoint'),
  responseHeaders: z
    .record(z.string(), z.string())
    .nullable()
    .describe('HTTP response headers (null if no response)'),
  responseBody: z
    .string()
    .nullable()
    .describe('Response body from the webhook endpoint (null if no response)'),
})

// ---------------------------------------------------------------------------
// Delivery list query and response schemas
// ---------------------------------------------------------------------------

/**
 * Query parameters for listing webhook deliveries.
 */
export const listDeliveriesQuerySchema = z.object({
  status: z
    .enum(['all', 'success', 'failed'])
    .optional()
    .describe('Filter deliveries by status (defaults to all)'),
  limit: z.string().optional().describe('Maximum number of deliveries to return'),
  cursor: z.string().optional().describe('Cursor for pagination (delivery ID to start after)'),
})

/**
 * Paginated response for webhook delivery logs.
 */
export const listDeliveriesResponseSchema = z.object({
  deliveries: z.array(webhookDeliverySchema).describe('List of delivery log entries'),
  nextCursor: z.string().nullable().describe('Cursor for the next page (null if no more results)'),
  totalCount: z.number().int().min(0).describe('Total number of matching deliveries'),
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
export const retryDeliveryResponseSchema = z.object({
  deliveryId: z.string().describe('ID of the new delivery log entry created for the retry'),
  status: z.literal('pending').describe('Initial status of the retry delivery'),
})

// ---------------------------------------------------------------------------
// Test webhook schema (US-TABLES-WEBHOOKS-006)
// ---------------------------------------------------------------------------

/**
 * Response for testing a webhook endpoint.
 *
 * Used for:
 * - POST /api/tables/:tableName/webhooks/:webhookName/test
 */
export const testWebhookResponseSchema = z.object({
  success: z.boolean().describe('Whether the test payload was delivered successfully'),
  httpStatus: z
    .number()
    .int()
    .nullable()
    .describe('HTTP response status code from the endpoint (null if unreachable)'),
  duration: z.number().min(0).describe('Round-trip time in milliseconds'),
  responseBody: z
    .string()
    .nullable()
    .describe('Response body from the webhook endpoint (null if unreachable)'),
  error: z.string().nullable().describe('Error message if the test delivery failed'),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type WebhookEvent = z.infer<typeof webhookEventSchema>
export type WebhookDeliveryStatus = z.infer<typeof webhookDeliveryStatusSchema>
export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>
export type WebhookDeliveryDetail = z.infer<typeof webhookDeliveryDetailSchema>
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>
export type ListDeliveriesResponse = z.infer<typeof listDeliveriesResponseSchema>
export type RetryDeliveryResponse = z.infer<typeof retryDeliveryResponseSchema>
export type TestWebhookResponse = z.infer<typeof testWebhookResponseSchema>
