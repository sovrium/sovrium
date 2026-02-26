/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { boolean, index, smallint, text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Analytics Page Views Table Schema
 *
 * Stores individual page view events for the built-in analytics engine.
 * Designed for privacy-first tracking without cookies or PII.
 *
 * Key design decisions:
 * - visitorHash: SHA-256(date + IP + UA + salt) — rotates daily, no PII stored
 * - sessionHash: SHA-256(visitorHash + time-window) — groups views into sessions
 * - No foreign keys to users table — analytics is anonymous
 * - All device/browser/OS data parsed server-side from User-Agent
 * - UTM parameters captured from tracking script payload
 *
 * Indexes optimized for:
 * - Time-series queries (overview, trends)
 * - Unique visitor counting
 * - Per-page analytics
 * - Referrer analysis
 * - UTM campaign analysis
 * - Device breakdown queries
 */
export const analyticsPageViews = systemSchema.table(
  'analytics_page_views',
  {
    // Primary key - UUID for distributed systems compatibility
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Event timestamp
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),

    // Application identifier (supports multi-app deployments)
    // Default 'default' enables direct INSERTs via system.page_views view without explicit app_name
    appName: text('app_name').notNull().default('default'),

    // Page information
    pagePath: text('page_path').notNull(),
    pageTitle: text('page_title'),

    // Privacy-safe visitor identification (no cookies, no PII)
    // SHA-256(date + IP + UA + salt) — rotates daily
    visitorHash: text('visitor_hash').notNull(),

    // Session identification
    // SHA-256(visitorHash + time-window) — groups views into sessions
    // Default gen_random_uuid() enables direct INSERTs via system.page_views view without explicit session_hash
    sessionHash: text('session_hash')
      .notNull()
      .default(sql`gen_random_uuid()`),

    // Whether this is the first page view in a session
    isEntrance: boolean('is_entrance').notNull().default(false),

    // Referrer information
    referrerUrl: text('referrer_url'),
    referrerDomain: text('referrer_domain'),

    // UTM campaign parameters
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    utmTerm: text('utm_term'),

    // Device information (parsed from User-Agent server-side)
    deviceType: text('device_type'), // 'desktop' | 'mobile' | 'tablet'
    browserName: text('browser_name'),
    osName: text('os_name'),

    // Visitor locale (from Accept-Language header)
    language: text('language'),

    // Screen dimensions (from tracking script)
    screenWidth: smallint('screen_width'),
    screenHeight: smallint('screen_height'),
  },
  (table) => [
    // Primary time-series index (overview queries, date range filtering)
    index('analytics_pv_app_timestamp_idx').on(table.appName, table.timestamp),

    // Unique visitor counting
    index('analytics_pv_app_visitor_timestamp_idx').on(
      table.appName,
      table.visitorHash,
      table.timestamp
    ),

    // Per-page analytics (top pages queries)
    index('analytics_pv_app_path_timestamp_idx').on(table.appName, table.pagePath, table.timestamp),

    // Referrer analysis (traffic sources queries)
    index('analytics_pv_app_referrer_idx').on(table.appName, table.referrerDomain),

    // UTM campaign analysis
    index('analytics_pv_app_utm_source_idx').on(table.appName, table.utmSource),

    // Device breakdown queries
    index('analytics_pv_app_device_idx').on(table.appName, table.deviceType),
  ]
)

// Type exports for consumers
export type AnalyticsPageView = typeof analyticsPageViews.$inferSelect
export type NewAnalyticsPageView = typeof analyticsPageViews.$inferInsert
