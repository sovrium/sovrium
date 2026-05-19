/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, serial, jsonb, customType, index, unique } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

const tsvector = (name: string) =>
  customType<{ data: string }>({
    dataType() {
      return 'tsvector'
    },
  })(name)

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

export const searchIndex = systemSchema.table(
  'search_index',
  {
    id: serial('id').primaryKey(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    contentTsv: tsvector('content_tsv').notNull(),
    rawContent: jsonb('raw_content').notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_search_index_tsv').using('gin', table.contentTsv),
    index('idx_search_index_table').on(table.tableName),
    unique('search_index_table_record_unique').on(table.tableName, table.recordId),
  ]
)

export type SearchIndex = typeof searchIndexes.$inferSelect
export type NewSearchIndex = typeof searchIndexes.$inferInsert
export type SearchIndexRow = typeof searchIndex.$inferSelect
export type NewSearchIndexRow = typeof searchIndex.$inferInsert
