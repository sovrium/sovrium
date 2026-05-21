/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index, unique } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'


export const searchIndexes = systemTable(
  'search_indexes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tableName: text('table_name').notNull(),
    fieldName: text('field_name').notNull(),
    indexType: text('index_type').notNull(),
    indexName: text('index_name').notNull(),
    lastReindexedAt: integer('last_reindexed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('search_indexes_table_field_idx').on(table.tableName, table.fieldName)]
)

export const searchIndex = systemTable(
  'search_index',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    rawContent: text('raw_content', { mode: 'json' }).notNull().default({}),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('idx_search_index_table').on(table.tableName),
    unique('search_index_table_record_unique').on(table.tableName, table.recordId),
  ]
)

export type SearchIndex = typeof searchIndexes.$inferSelect
export type NewSearchIndex = typeof searchIndexes.$inferInsert
export type SearchIndexRow = typeof searchIndex.$inferSelect
export type NewSearchIndexRow = typeof searchIndex.$inferInsert
