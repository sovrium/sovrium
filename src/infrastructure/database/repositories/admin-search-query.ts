/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
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
 * The admin-search content table reference for the active dialect.
 *
 * Shared by the repository, the prune below and the boot-time purge
 * (`admin-search-index-purge.ts`), so all three name the SAME relation — the dialect branch must not be
 * restated in a second place.
 */
export const adminSearchContentTableRef = (): SQL =>
  // sql-literal: identifier -- a module constant naming the search content table
  isSqliteRuntime() ? sql.raw(ADMIN_SEARCH_CONTENT_TABLE) : sql.raw('system."_admin_search_index"')

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

/** What a rebuild keeps: the kinds it produces, and the config-derived rows it lists in full. */
export interface AdminSearchPruneInput {
  readonly producedKinds: readonly AdminSearchEntityType[]
  readonly configRows: ReadonlyArray<{
    readonly type: AdminSearchEntityType
    readonly entityId: string
  }>
  readonly configKinds: readonly AdminSearchEntityType[]
}

/** A parameter-bound `(v1, v2, …)` list (S3); callers guarantee it is non-empty. */
const boundList = (values: readonly string[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )

/**
 * Delete the index rows a rebuild no longer produces: every row of a kind
 * outside `producedKinds` (a kind an older version indexed, such as the
 * retired per-type UI-kit pages), and every config-derived row (`configKinds`)
 * whose entity is not in this rebuild's `configRows` — a connection removed
 * from the config, a design-system page the app is no longer served.
 *
 * The rebuild upserts; without this it never deletes, so such a row would be
 * served until the next boot purge, and its link answers 404. On SQLite the
 * content table's `…_ad` trigger drops the row's tokens from the FTS index too.
 */
export const pruneAdminIndex = async ({
  producedKinds,
  configRows,
  configKinds,
}: AdminSearchPruneInput): Promise<void> => {
  const table = adminSearchContentTableRef()
  await executeRaw(db, sql`DELETE FROM ${table} WHERE type NOT IN (${boundList(producedKinds)})`)
  for (const kind of configKinds) {
    const ids = configRows.filter((row) => row.type === kind).map((row) => row.entityId)
    const keep = ids.length > 0 ? sql` AND entity_id NOT IN (${boundList(ids)})` : sql``
    await executeRaw(db, sql`DELETE FROM ${table} WHERE type = ${kind}${keep}`)
  }
}
