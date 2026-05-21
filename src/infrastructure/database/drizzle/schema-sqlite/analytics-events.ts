/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { index, text, integer } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

export const analyticsEvents = systemTable(
  'analytics_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    appName: text('app_name').notNull().default('default'),

    eventType: text('event_type').notNull(),

    eventName: text('event_name'),

    orgId: text('org_id'),

    visitorHash: text('visitor_hash').notNull(),

    sessionHash: text('session_hash')
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),

    timestamp: integer('timestamp', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),

    properties: text('properties', { mode: 'json' }).notNull().default({}),
  },
  (table) => [
    index('analytics_events_app_type_ts_idx').on(table.appName, table.eventType, table.timestamp),


    index('analytics_events_app_visitor_idx').on(table.appName, table.visitorHash),

    index('analytics_events_app_session_idx').on(table.appName, table.sessionHash),
  ]
)

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert
