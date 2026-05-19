/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

export const analyticsEvents = systemSchema.table(
  'analytics_events',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    appName: text('app_name').notNull().default('default'),

    eventType: text('event_type').notNull(),

    eventName: text('event_name'),

    orgId: text('org_id'),

    visitorHash: text('visitor_hash').notNull(),

    sessionHash: text('session_hash')
      .notNull()
      .default(sql`gen_random_uuid()`),

    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),

    properties: jsonb('properties').notNull().default({}),
  },
  (table) => [
    index('analytics_events_app_type_ts_idx').on(table.appName, table.eventType, table.timestamp),

    index('analytics_events_properties_gin_idx').using('gin', table.properties),

    index('analytics_events_app_visitor_idx').on(table.appName, table.visitorHash),

    index('analytics_events_app_session_idx').on(table.appName, table.sessionHash),
  ]
)

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert
