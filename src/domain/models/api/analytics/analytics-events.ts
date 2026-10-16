/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uuid } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { withDefault } from '../combinators/schema-defaults'

// ============================================================================
// Query Parameters Schema (GET /api/analytics/events)
// ============================================================================

/**
 * List events query parameters schema
 *
 * Supports filtering by event type, event name, date range,
 * and offset-based pagination.
 */
export const listEventsQuerySchema = Schema.Struct({
  /** Filter by event type (page_view or track) */
  event_type: optionalField(
    Schema.String.annotate({ description: 'Filter by event type (page_view or track)' })
  ),
  /** Filter by custom event name */
  event_name: optionalField(Schema.String.annotate({ description: 'Filter by custom event name' })),
  /** Start of date range (ISO 8601) */
  from: optionalField(
    Schema.String.annotate({ description: 'Start of date range (ISO 8601 datetime)' })
  ),
  /** End of date range (ISO 8601) */
  to: optionalField(
    Schema.String.annotate({ description: 'End of date range (ISO 8601 datetime)' })
  ),
  /** Maximum number of events to return */
  limit: Schema.Int.annotate({
    description: 'Maximum number of events to return (1-1000, default 50)',
  }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(1000)),
    withDefault(50)
  ),
  /** Pagination offset */
  offset: Schema.Int.annotate({ description: 'Pagination offset (default 0)' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    withDefault(0)
  ),
})

export type ListEventsQuery = typeof listEventsQuerySchema.Type

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Single analytics event response schema.
 *
 * The keys are snake_case, matching the `event_type` / `event_name` query
 * parameters and the stored column names: this is the shape
 * `GET /api/analytics/events` has always answered, and the reader every
 * client of it was written against. The handler shapes each event through
 * this schema, so the documented contract and the wire cannot drift apart.
 */
export const analyticsEventResponseSchema = Schema.Struct({
  /** Unique event identifier */
  id: uuid({ description: 'Unique event identifier' }),
  /** Application name that recorded the event */
  app_name: Schema.String.annotate({ description: 'Application name that recorded the event' }),
  /** Event type discriminator */
  event_type: Schema.String.annotate({
    description: 'Event type: page_view, track, link_click, qr_scan, …',
  }),
  /** Custom event name (null for page_view events) */
  event_name: Schema.NullOr(
    Schema.String.annotate({
      description:
        'Event name: the tracked name, or the link slug for a link_click. Null for page_view events',
    })
  ),
  /** Optional organization id */
  org_id: Schema.NullOr(
    Schema.String.annotate({ description: 'Organization the event was recorded under, if any' })
  ),
  /** SHA-256 hashed visitor identifier */
  visitor_hash: Schema.String.annotate({ description: 'SHA-256 hashed visitor identifier' }),
  /** SHA-256 hashed session identifier */
  session_hash: Schema.String.annotate({ description: 'SHA-256 hashed session identifier' }),
  /** When the event was recorded */
  timestamp: looseIsoDateTime({ description: 'ISO 8601 timestamp of when the event was recorded' }),
  /** Arbitrary event properties */
  properties: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'Arbitrary key-value properties attached to the event',
  }),
})

export type AnalyticsEventResponse = typeof analyticsEventResponseSchema.Type

/**
 * Paginated list of analytics events response schema
 *
 * GET /api/analytics/events
 */
export const listEventsResponseSchema = Schema.Struct({
  /** Array of analytics events */
  events: Schema.Array(analyticsEventResponseSchema).annotate({
    description: 'Array of analytics events',
  }),
  /** Pagination metadata */
  pagination: Schema.Struct({
    /** Total number of matching events */
    total: Schema.Int.annotate({ description: 'Total number of matching events' }),
    /** Max results per page */
    limit: Schema.Int.annotate({ description: 'Max results per page' }),
    /** Current pagination offset */
    offset: Schema.Int.annotate({ description: 'Current pagination offset' }),
    /** Whether there are more results */
    hasMore: Schema.Boolean.annotate({ description: 'Whether there are more results' }),
  }),
})

export type ListEventsResponse = typeof listEventsResponseSchema.Type
