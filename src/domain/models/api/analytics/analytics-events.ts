/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const listEventsQuerySchema = z.object({
  event_type: z.string().optional().describe('Filter by event type (page_view or track)'),
  event_name: z.string().optional().describe('Filter by custom event name'),
  from: z.string().optional().describe('Start of date range (ISO 8601 datetime)'),
  to: z.string().optional().describe('End of date range (ISO 8601 datetime)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe('Maximum number of events to return (1-1000, default 50)'),
  offset: z.number().int().min(0).default(0).describe('Pagination offset (default 0)'),
})

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>


export const analyticsEventResponseSchema = z.object({
  id: z.string().uuid().describe('Unique event identifier'),
  appName: z.string().describe('Application name that recorded the event'),
  eventType: z.string().describe('Event type (page_view or track)'),
  eventName: z.string().nullable().describe('Custom event name (null for page_view events)'),
  visitorHash: z.string().describe('SHA-256 hashed visitor identifier'),
  sessionHash: z.string().describe('SHA-256 hashed session identifier'),
  timestamp: z.string().datetime().describe('ISO 8601 timestamp of when the event was recorded'),
  properties: z
    .record(z.string(), z.unknown())
    .describe('Arbitrary key-value properties attached to the event'),
})

export type AnalyticsEventResponse = z.infer<typeof analyticsEventResponseSchema>

export const listEventsResponseSchema = z.object({
  events: z.array(analyticsEventResponseSchema).describe('Array of analytics events'),
  pagination: z.object({
    total: z.number().int().describe('Total number of matching events'),
    limit: z.number().int().describe('Max results per page'),
    offset: z.number().int().describe('Current pagination offset'),
    hasMore: z.boolean().describe('Whether there are more results'),
  }),
})

export type ListEventsResponse = z.infer<typeof listEventsResponseSchema>
