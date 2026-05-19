/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { automationDefinitions } from './automation'
import { systemSchema } from './migration-audit'

export const automationDigestBuckets = systemSchema.table(
  'automation_digest_buckets',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    automationId: text('automation_id')
      .notNull()
      .references(() => automationDefinitions.id, { onDelete: 'cascade' }),
    digestKey: text('digest_key').notNull(),
    status: text('status').notNull().default('collecting'),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('automation_digest_buckets_automation_key_idx').on(table.automationId, table.digestKey),
    index('automation_digest_buckets_status_idx').on(table.status),
  ]
)

export const automationDigestItems = systemSchema.table(
  'automation_digest_items',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bucketId: text('bucket_id')
      .notNull()
      .references(() => automationDigestBuckets.id, { onDelete: 'cascade' }),
    item: jsonb('item').notNull(),
    dedupeKey: text('dedupe_key'),
    collectedAt: timestamp('collected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('automation_digest_items_bucketId_idx').on(table.bucketId),
    index('automation_digest_items_dedupeKey_idx').on(table.dedupeKey),
  ]
)

export type AutomationDigestBucket = typeof automationDigestBuckets.$inferSelect
export type NewAutomationDigestBucket = typeof automationDigestBuckets.$inferInsert
export type AutomationDigestItem = typeof automationDigestItems.$inferSelect
export type NewAutomationDigestItem = typeof automationDigestItems.$inferInsert
