/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Analytics Events Table Schema
 *
 * Unified table for all analytics events: page views and custom tracked events.
 * Replaces the old analytics_page_views table.
 *
 * Key design decisions:
 * - eventType: 'page_view' | 'track' — distinguishes page views from custom events
 * - eventName: user-supplied name for 'track' events (null for page views)
 * - properties: JSONB column stores event-specific data (page info, device info, UTM, etc.)
 * - visitorHash / sessionHash: promoted to top-level columns for efficient aggregation
 * - orgId: optional organization ID for multi-tenant tracking
 *
 * For page_view events, properties contains:
 *   path, title, isEntrance, referrerUrl, referrerDomain, utmSource, utmMedium,
 *   utmCampaign, utmContent, utmTerm, deviceType, browserName, osName, language,
 *   screenWidth, screenHeight
 *
 * For track events, properties contains user-defined key-value pairs.
 */
export const analyticsEvents = systemSchema.table(
  'analytics_events',
  {
    // Primary key - UUID for distributed systems compatibility
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

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
      .default(sql`gen_random_uuid()`),

    // Event timestamp
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),

    // Event-specific data (page info, device info, UTM params, or custom properties)
    properties: jsonb('properties').notNull().default({}),
  },
  (table) => [
    // Primary time-series index with event type filtering
    index('analytics_events_app_type_ts_idx').on(table.appName, table.eventType, table.timestamp),

    // GIN index on properties for JSONB queries
    index('analytics_events_properties_gin_idx').using('gin', table.properties),

    // Unique visitor counting
    index('analytics_events_app_visitor_idx').on(table.appName, table.visitorHash),

    // Session grouping
    index('analytics_events_app_session_idx').on(table.appName, table.sessionHash),
  ]
)

// Type exports for consumers
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert
