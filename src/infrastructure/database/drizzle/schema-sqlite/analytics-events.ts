/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { index, text, integer } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * Analytics Events Table Schema — sqlite-core mirror of
 * `schema/analytics-events.ts`.
 *
 * Unified table for all analytics events: page views and custom tracked events.
 *
 * Key design decisions:
 * - eventType: 'page_view' | 'track' — distinguishes page views from custom events
 * - eventName: user-supplied name for 'track' events (null for page views)
 * - properties: JSON column stores event-specific data (page info, device info, UTM, etc.)
 * - visitorHash / sessionHash: promoted to top-level columns for efficient aggregation
 * - orgId: optional organization ID for multi-tenant tracking
 *
 * SQLite: the pg-core GIN index on `properties` is dropped (no SQLite
 * equivalent); JSON property queries fall back to scan-based filtering.
 */
export const analyticsEvents = systemTable(
  'analytics_events',
  {
    // Primary key - UUID for distributed systems compatibility
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Application identifier (supports multi-app deployments)
    appName: text('app_name').notNull().default('default'),

    // Event type discriminator
    eventType: text('event_type').notNull(),

    // User-supplied event name for 'track' events (null for page_view)
    eventName: text('event_name'),

    // Optional organization ID for multi-tenant tracking
    orgId: text('org_id'),

    // Privacy-safe visitor identification (no cookies, no PII)
    // SHA-256(date + IP + UA + salt) — rotates daily
    visitorHash: text('visitor_hash').notNull(),

    // Session identification
    // SHA-256(visitorHash + time-window) — groups views into sessions
    sessionHash: text('session_hash')
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),

    // Event timestamp
    timestamp: integer('timestamp', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),

    // Event-specific data (page info, device info, UTM params, or custom properties)
    properties: text('properties', { mode: 'json' }).notNull().default({}),
  },
  (table) => [
    // Primary time-series index with event type filtering
    index('analytics_events_app_type_ts_idx').on(table.appName, table.eventType, table.timestamp),

    // SQLite: GIN index on properties dropped — no SQLite equivalent

    // Unique visitor counting
    // Serves the event-name narrowing the six readers gained: "this link's
    // clicks", "this form's submissions". Also what makes the maxClicks count
    // index-served rather than a scan within the app+type range.
    index('analytics_events_app_type_name_idx').on(table.appName, table.eventType, table.eventName),
    index('analytics_events_app_visitor_idx').on(table.appName, table.visitorHash),

    // Session grouping
    index('analytics_events_app_session_idx').on(table.appName, table.sessionHash),
  ]
)

// Type exports for consumers
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert
