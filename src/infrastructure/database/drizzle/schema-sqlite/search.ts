/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index, unique } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * Search tables — sqlite-core mirror of `schema/search.ts`.
 *
 * NOTE — full-text-search degradation: the pg-core `search_index` table has a
 * `content_tsv tsvector` column plus a GIN index powering the `@@` full-text
 * match. SQLite has no `tsvector`/GIN equivalent, so the column and index are
 * omitted from this mirror — FTS degrades to a hard `501 requires-postgres` in
 * SQLite mode. See unsupported-in-sqlite.ts (Phase 5).
 */

/**
 * Search Indexes Table
 *
 * Tracks FTS/trigram index state per table per field.
 * Used by the search service to manage full-text search index metadata.
 */
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

/**
 * Search Index Content Table
 *
 * Stores the indexed content rows backing full-text search across dynamically
 * created user tables. Distinct from `search_indexes`, which stores index
 * *metadata* (which table/field, last reindex time) — this table holds the
 * indexed content itself.
 *
 * SQLite: the pg-core `content_tsv tsvector` column and its GIN index are
 * omitted — FTS degrades in SQLite mode. See unsupported-in-sqlite.ts
 * (Phase 5). The `raw_content` JSON column is kept so the table still exists.
 */
export const searchIndex = systemTable(
  'search_index',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    // SQLite: tsvector content_tsv column omitted — FTS degrades — see unsupported-in-sqlite.ts (Phase 5)
    rawContent: text('raw_content', { mode: 'json' }).notNull().default({}),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    // SQLite: GIN tsvector index dropped — FTS degrades — see unsupported-in-sqlite.ts (Phase 5)
    index('idx_search_index_table').on(table.tableName),
    unique('search_index_table_record_unique').on(table.tableName, table.recordId),
  ]
)

// Type inference
export type SearchIndex = typeof searchIndexes.$inferSelect
export type NewSearchIndex = typeof searchIndexes.$inferInsert
export type SearchIndexRow = typeof searchIndex.$inferSelect
export type NewSearchIndexRow = typeof searchIndex.$inferInsert
