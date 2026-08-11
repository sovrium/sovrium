/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

// ============================================================================
// Query Parameters Schema (GET /api/analytics/events)
// ============================================================================

/**
 * List events query parameters schema
 *
 * Supports filtering by event type, event name, date range,
 * and offset-based pagination.
 */
export const listEventsQuerySchema = z.object({
  /** Filter by event type (page_view or track) */
  event_type: z.string().optional().describe('Filter by event type (page_view or track)'),
  /** Filter by custom event name */
  event_name: z.string().optional().describe('Filter by custom event name'),
  /** Start of date range (ISO 8601) */
  from: z.string().optional().describe('Start of date range (ISO 8601 datetime)'),
  /** End of date range (ISO 8601) */
  to: z.string().optional().describe('End of date range (ISO 8601 datetime)'),
  /** Maximum number of events to return */
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe('Maximum number of events to return (1-1000, default 50)'),
  /** Pagination offset */
  offset: z.number().int().min(0).default(0).describe('Pagination offset (default 0)'),
})

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Single analytics event response schema
 */
export const analyticsEventResponseSchema = z.object({
  /** Unique event identifier */
  id: z.string().uuid().describe('Unique event identifier'),
  /** Application name that recorded the event */
  appName: z.string().describe('Application name that recorded the event'),
  /** Event type discriminator */
  eventType: z.string().describe('Event type (page_view or track)'),
  /** Custom event name (null for page_view events) */
  eventName: z.string().nullable().describe('Custom event name (null for page_view events)'),
  /** SHA-256 hashed visitor identifier */
  visitorHash: z.string().describe('SHA-256 hashed visitor identifier'),
  /** SHA-256 hashed session identifier */
  sessionHash: z.string().describe('SHA-256 hashed session identifier'),
  /** When the event was recorded */
  timestamp: z.string().datetime().describe('ISO 8601 timestamp of when the event was recorded'),
  /** Arbitrary event properties */
  properties: z
    .record(z.string(), z.unknown())
    .describe('Arbitrary key-value properties attached to the event'),
})

export type AnalyticsEventResponse = z.infer<typeof analyticsEventResponseSchema>

/**
 * Paginated list of analytics events response schema
 *
 * GET /api/analytics/events
 */
export const listEventsResponseSchema = z.object({
  /** Array of analytics events */
  events: z.array(analyticsEventResponseSchema).describe('Array of analytics events'),
  /** Pagination metadata */
  pagination: z.object({
    /** Total number of matching events */
    total: z.number().int().describe('Total number of matching events'),
    /** Max results per page */
    limit: z.number().int().describe('Max results per page'),
    /** Current pagination offset */
    offset: z.number().int().describe('Current pagination offset'),
    /** Whether there are more results */
    hasMore: z.boolean().describe('Whether there are more results'),
  }),
})

export type ListEventsResponse = z.infer<typeof listEventsResponseSchema>
