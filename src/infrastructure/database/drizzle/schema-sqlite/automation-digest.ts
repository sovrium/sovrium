/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { automationDefinitions } from './automation'
import { systemTable } from './table-helpers'


export const automationDigestBuckets = systemTable(
  'automation_digest_buckets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    automationId: text('automation_id')
      .notNull()
      .references(() => automationDefinitions.id, { onDelete: 'cascade' }),
    digestKey: text('digest_key').notNull(),
    status: text('status').notNull().default('collecting'),
    releasedAt: integer('released_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('automation_digest_buckets_automation_key_idx').on(table.automationId, table.digestKey),
    index('automation_digest_buckets_status_idx').on(table.status),
  ]
)

export const automationDigestItems = systemTable(
  'automation_digest_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bucketId: text('bucket_id')
      .notNull()
      .references(() => automationDigestBuckets.id, { onDelete: 'cascade' }),
    item: text('item', { mode: 'json' }).notNull(),
    dedupeKey: text('dedupe_key'),
    collectedAt: integer('collected_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
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
