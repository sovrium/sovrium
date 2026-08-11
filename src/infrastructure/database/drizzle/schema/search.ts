/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, serial, jsonb, customType, index, unique } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Custom `tsvector` column type for PostgreSQL full-text search.
 */
const tsvector = (name: string) =>
  customType<{ data: string }>({
    dataType() {
      return 'tsvector'
    },
  })(name)

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

/**
 * Search Index Content Table
 *
 * Stores the actual `tsvector` content rows backing PostgreSQL full-text
 * search across dynamically created user tables. Distinct from
 * `search_indexes`, which stores index *metadata* (which table/field, last
 * reindex time) — this table holds the indexed content itself.
 *
 * Maintained by `fts-manager.ts`. The GIN index on `content_tsv` powers the
 * `@@` full-text match; the `(table_name, record_id)` unique constraint keeps
 * one row per record so reindexing is an upsert.
 */
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

// Type inference
export type SearchIndex = typeof searchIndexes.$inferSelect
export type NewSearchIndex = typeof searchIndexes.$inferInsert
export type SearchIndexRow = typeof searchIndex.$inferSelect
export type NewSearchIndexRow = typeof searchIndex.$inferInsert
