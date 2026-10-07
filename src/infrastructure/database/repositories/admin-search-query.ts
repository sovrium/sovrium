/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import {
  ADMIN_SEARCH_CONTENT_TABLE,
  ADMIN_SEARCH_FTS_TABLE,
} from '@/infrastructure/database/lookup/admin-search-fts-ddl'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { entityIdOfIndexRow } from './admin-search-record-key'
import type { AdminSearchIndexHit } from '@/application/ports/repositories/admin-search-repository'
import type { AdminSearchEntityType } from '@/domain/models/api/admin/search/search'

/**
 * Build the SQLite FTS5 MATCH expression from a raw query: split into
 * alphanumeric tokens and AND them as prefix terms. A token-prefix match makes
 * `Zaphod` match the title `Zaphod CRM connection` and `admin@example.com`
 * match (its `@`/`.`-delimited tokens). An all-empty token set yields no match.
 */
const toFtsMatch = (query: string): string =>
  query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
    .map((token) => `${token}*`)
    .join(' AND ')

/** Map a raw index row to the port's hit shape. */
const toHit = (row: Readonly<Record<string, unknown>>): AdminSearchIndexHit => ({
  type: String(row['type']) as AdminSearchEntityType,
  entityId: entityIdOfIndexRow(row['type'], String(row['entity_id'])),
  title: typeof row['title'] === 'string' ? row['title'] : '',
  href: typeof row['href'] === 'string' ? row['href'] : '',
  updatedAt: row['updated_at'] as Date | string | number,
})

/** Run the SQLite FTS5 search. */
const searchSqlite = (query: string): Promise<readonly AdminSearchIndexHit[]> => {
  const match = toFtsMatch(query)
  if (match.length === 0) return Promise.resolve([])
  // sql-literal: identifier -- a module constant naming the search content table
  const contentTable = sql.raw(ADMIN_SEARCH_CONTENT_TABLE)
  // sql-literal: identifier -- a module constant naming the full-text table
  const ftsTable = sql.raw(ADMIN_SEARCH_FTS_TABLE)
  return executeRaw(
    db,
    sql`SELECT c.type, c.entity_id, c.title, c.href, c.updated_at
        FROM ${contentTable} AS c
        JOIN ${ftsTable} AS f ON f.rowid = c.id
        WHERE ${ftsTable} MATCH ${match}
        ORDER BY c.updated_at DESC
        LIMIT 200`
  )
    .then((rows) => rows.map(toHit))
    .catch(() => [])
}

/** Run the PostgreSQL tsvector search. */
const searchPostgres = (query: string): Promise<readonly AdminSearchIndexHit[]> =>
  executeRaw(
    db,
    sql`SELECT type, entity_id, title, href, updated_at
        FROM system."_admin_search_index"
        WHERE content_tsv @@ plainto_tsquery('simple', ${query})
        ORDER BY updated_at DESC
        LIMIT 200`
  )
    .then((rows) => rows.map(toHit))
    .catch(() => [])

/**
 * The admin search index's full-text query, dispatched on the active dialect
 * (an FTS5 `MATCH` join on SQLite, `content_tsv @@ plainto_tsquery` on PG).
 * A failing query resolves to no hits rather than rejecting.
 */
export const searchAdminIndex = (query: string): Promise<readonly AdminSearchIndexHit[]> =>
  isSqliteRuntime() ? searchSqlite(query) : searchPostgres(query)
