/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { logInfo } from '@/infrastructure/logging/logger'

/**
 * PostgreSQL Full-Text Search manager.
 *
 * Uses tsvector/GIN indexes for fast full-text search across
 * dynamically created user tables. The search index is stored
 * in a dedicated _sovrium_search_index table.
 */

export const ensureSearchIndex = async (): Promise<void> => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS _sovrium_search_index (
      id SERIAL PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      content_tsv TSVECTOR NOT NULL,
      raw_content JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(table_name, record_id)
    )
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_search_index_tsv
    ON _sovrium_search_index USING GIN (content_tsv)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_search_index_table
    ON _sovrium_search_index (table_name)
  `)
}

export const ftsSearch = async (
  query: string,
  options?: {
    readonly tableName?: string
    readonly limit?: number
    readonly offset?: number
  }
): Promise<readonly Record<string, unknown>[]> => {
  await ensureSearchIndex()
  const limit = options?.limit ?? 20
  const offset = options?.offset ?? 0

  const tsQuery = sql`plainto_tsquery('english', ${query})`

  const whereClause = options?.tableName
    ? sql`content_tsv @@ ${tsQuery} AND table_name = ${options.tableName}`
    : sql`content_tsv @@ ${tsQuery}`

  const rows = await db.execute(sql`
    SELECT
      record_id,
      table_name,
      ts_rank(content_tsv, ${tsQuery}) AS rank,
      ts_headline('english', raw_content::text, ${tsQuery}, 'MaxWords=50, MinWords=15') AS headline,
      raw_content
    FROM _sovrium_search_index
    WHERE ${whereClause}
    ORDER BY rank DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  return (rows as readonly Record<string, unknown>[]).map((row) => {
    const r = row as {
      record_id: string
      table_name: string
      rank: number
      headline: string
      raw_content: Record<string, unknown>
    }
    return {
      id: r.record_id,
      tableName: r.table_name,
      rank: r.rank,
      headline: r.headline,
      data: r.raw_content,
    } as Record<string, unknown>
  })
}

export const ftsReindex = async (tableName: string, _fieldName?: string): Promise<void> => {
  // Full reindex: would read all records from the table,
  // extract searchable fields, and upsert into search index.
  // This is a placeholder — actual implementation depends on
  // dynamic table schema resolution.
  logInfo(`[search] reindex requested for table ${tableName}`)
}

export const ftsCreateIndex = async (
  tableName: string,
  fieldName: string,
  indexType: string
): Promise<void> => {
  // Stub: would create a search index for a specific field
  logInfo(`[search] createIndex table=${tableName} field=${fieldName} type=${indexType}`)
}
