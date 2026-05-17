/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, index } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Search Indexes Table
 *
 * Tracks FTS/trigram index state per table per field.
 * Used by the search service to manage PostgreSQL full-text search indexes.
 */
export const searchIndexes = systemSchema.table(
  'search_indexes',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tableName: text('table_name').notNull(),
    fieldName: text('field_name').notNull(),
    indexType: text('index_type').notNull(),
    indexName: text('index_name').notNull(),
    lastReindexedAt: timestamp('last_reindexed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('search_indexes_table_field_idx').on(table.tableName, table.fieldName)]
)

// Type inference
export type SearchIndex = typeof searchIndexes.$inferSelect
export type NewSearchIndex = typeof searchIndexes.$inferInsert
