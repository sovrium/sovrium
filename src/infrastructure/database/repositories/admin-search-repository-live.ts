/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AdminSearchRepository,
  AdminSearchDatabaseError,
  type AdminSearchIndexHit,
  type AdminSearchStaleness,
  type AdminSearchUpsertRow,
} from '@/application/ports/repositories/admin-search-repository'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { db } from '@/infrastructure/database'
import {
  ADMIN_SEARCH_CONTENT_TABLE,
  ADMIN_SEARCH_FTS_TABLE,
} from '@/infrastructure/database/lookup/admin-search-fts-ddl'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { AdminSearchEntityType } from '@/domain/models/api/admin/search/search'


const wrap = makeDbWrap((cause) => new AdminSearchDatabaseError({ cause }))

const systemTableRef = (logical: string): SQL =>
  isSqliteRuntime() ? sql.raw(`system_${logical}`) : sql.raw(`system."${logical}"`)

const contentTableRef = (): SQL =>
  isSqliteRuntime() ? sql.raw(ADMIN_SEARCH_CONTENT_TABLE) : sql.raw('system."_admin_search_index"')

const updatedAtValue = (date: Date): number | Date => (isSqliteRuntime() ? date.getTime() : date)


const readTableRecords = (
  displayName: string,
  textColumns: readonly string[]
): Promise<readonly AdminSearchUpsertRow[]> => {
  const physical = sanitizeTableName(displayName)
  const labelExpr =
    textColumns.length > 0
      ? sql.join(
          textColumns.map((column) => sql.identifier(column)),
          sql`, `
        )
      : sql`id`
  return executeRaw(
    db,
    sql`SELECT id AS entity_id, COALESCE(${labelExpr}, CAST(id AS TEXT)) AS title
        FROM ${sql.identifier(physical)}
        LIMIT 500`
  )
    .then((rows) =>
      rows.map((row): AdminSearchUpsertRow => ({
        type: 'record',
        entityId: String(row['entity_id']),
        title: typeof row['title'] === 'string' ? row['title'] : String(row['entity_id']),
        body: '',
        href: `/_admin/tables/${displayName}?record=${encodeURIComponent(String(row['entity_id']))}`,
        updatedAt: new Date(),
      }))
    )
    .catch(() => [])
}

const readSubmissions = (): Promise<readonly AdminSearchUpsertRow[]> =>
  executeRaw(
    db,
    sql`SELECT id AS entity_id, form_name, CAST(data AS TEXT) AS data_text
        FROM ${systemTableRef('form_submissions')}
        WHERE deleted_at IS NULL
        LIMIT 500`
  )
    .then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const formName = typeof row['form_name'] === 'string' ? row['form_name'] : 'formulaire'
        const dataText = typeof row['data_text'] === 'string' ? row['data_text'] : ''
        return {
          type: 'submission',
          entityId: String(row['entity_id']),
          title: `Soumission · ${formName}`,
          body: dataText.slice(0, 500),
          href: `/_admin/forms/${formName}`,
          updatedAt: new Date(),
        }
      })
    )
    .catch(() => [])

const readRuns = (): Promise<readonly AdminSearchUpsertRow[]> =>
  executeRaw(
    db,
    sql`SELECT r.id AS entity_id, d.name AS automation_name, r.status AS status,
               COALESCE(r.error, '') AS error
        FROM ${systemTableRef('automation_runs')} AS r
        LEFT JOIN ${systemTableRef('automation_definitions')} AS d ON d.id = r.automation_id
        LIMIT 500`
  )
    .then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const name =
          typeof row['automation_name'] === 'string' ? row['automation_name'] : 'automatisation'
        const status = typeof row['status'] === 'string' ? row['status'] : ''
        return {
          type: 'run',
          entityId: String(row['entity_id']),
          title: `Exécution · ${name}`,
          body: `${status} ${typeof row['error'] === 'string' ? row['error'] : ''}`.trim(),
          href: '/_admin/automations',
          updatedAt: new Date(),
        }
      })
    )
    .catch(() => [])

const readUsers = (): Promise<readonly AdminSearchUpsertRow[]> => {
  const userTable: SQL = isSqliteRuntime() ? sql.raw('auth_user') : sql.raw('auth."user"')
  return executeRaw(db, sql`SELECT id AS entity_id, email, name FROM ${userTable} LIMIT 500`)
    .then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const email = typeof row['email'] === 'string' ? row['email'] : ''
        const name = typeof row['name'] === 'string' ? row['name'] : ''
        const title = email.length > 0 ? email : name || String(row['entity_id'])
        return {
          type: 'user',
          entityId: String(row['entity_id']),
          title,
          body: name,
          href: '/_admin/users',
          updatedAt: new Date(),
        }
      })
    )
    .catch(() => [])
}

const readFiles = (): Promise<readonly AdminSearchUpsertRow[]> =>
  executeRaw(
    db,
    sql`SELECT id AS entity_id, filename, table_name
        FROM ${systemTableRef('file_storage_metadata')}
        LIMIT 500`
  )
    .then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const filename = typeof row['filename'] === 'string' ? row['filename'] : 'fichier'
        return {
          type: 'file',
          entityId: String(row['entity_id']),
          title: filename,
          body: '',
          href: '/_admin/buckets',
          updatedAt: new Date(),
        }
      })
    )
    .catch(() => [])

const readConversations = (): Promise<readonly AdminSearchUpsertRow[]> =>
  executeRaw(
    db,
    sql`SELECT id AS entity_id, COALESCE(title, '') AS title, COALESCE(agent_name, '') AS agent_name
        FROM ${systemTableRef('ai_conversations')}
        LIMIT 500`
  )
    .then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const title =
          typeof row['title'] === 'string' && row['title'].length > 0
            ? row['title']
            : `Conversation · ${typeof row['agent_name'] === 'string' ? row['agent_name'] : 'agent'}`
        return {
          type: 'conversation',
          entityId: String(row['entity_id']),
          title,
          body: typeof row['agent_name'] === 'string' ? row['agent_name'] : '',
          href: '/_admin/agents',
          updatedAt: new Date(),
        }
      })
    )
    .catch(() => [])

const upsertRow = (row: AdminSearchUpsertRow): Promise<unknown> =>
  executeRaw(
    db,
    sql`INSERT INTO ${contentTableRef()} (type, entity_id, title, body, href, updated_at)
        VALUES (${row.type}, ${row.entityId}, ${row.title}, ${row.body}, ${row.href}, ${updatedAtValue(row.updatedAt)})
        ON CONFLICT (type, entity_id) DO UPDATE
          SET title = excluded.title,
              body = excluded.body,
              href = excluded.href,
              updated_at = excluded.updated_at`
  )


const toFtsMatch = (query: string): string =>
  query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
    .map((token) => `${token}*`)
    .join(' AND ')

const toHit = (row: Record<string, unknown>): AdminSearchIndexHit => ({
  type: String(row['type']) as AdminSearchEntityType,
  entityId: String(row['entity_id']),
  title: typeof row['title'] === 'string' ? row['title'] : '',
  href: typeof row['href'] === 'string' ? row['href'] : '',
  updatedAt: row['updated_at'] as Date | string | number,
})

const searchSqlite = (query: string): Promise<readonly AdminSearchIndexHit[]> => {
  const match = toFtsMatch(query)
  if (match.length === 0) return Promise.resolve([])
  return executeRaw(
    db,
    sql`SELECT c.type, c.entity_id, c.title, c.href, c.updated_at
        FROM ${sql.raw(ADMIN_SEARCH_CONTENT_TABLE)} AS c
        JOIN ${sql.raw(ADMIN_SEARCH_FTS_TABLE)} AS f ON f.rowid = c.id
        WHERE ${sql.raw(ADMIN_SEARCH_FTS_TABLE)} MATCH ${match}
        ORDER BY c.updated_at DESC
        LIMIT 200`
  )
    .then((rows) => rows.map(toHit))
    .catch(() => [])
}

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

export const AdminSearchRepositoryLive = Layer.succeed(AdminSearchRepository, {
  indexStaleness: () =>
    wrap(async (): Promise<AdminSearchStaleness> => {
      const rows = await executeRaw(
        db,
        sql`SELECT COUNT(*) AS row_count, MAX(updated_at) AS last_built
            FROM ${contentTableRef()}`
      )
      const row = rows[0] ?? {}
      const count = Number(row['row_count'] ?? 0)
      const lastRaw = row['last_built']
      const lastBuiltAt =
        lastRaw === null || lastRaw === undefined
          ? undefined
          : lastRaw instanceof Date
            ? lastRaw
            : new Date(typeof lastRaw === 'number' ? lastRaw : Number(lastRaw) || String(lastRaw))
      return { isEmpty: count === 0, lastBuiltAt }
    }),

  rebuildIndex: ({ tables, extraRows }) =>
    wrap(async () => {
      const perTable = await Promise.all(
        tables.map((table) => readTableRecords(table.displayName, table.textColumns))
      )
      const [submissions, runs, users, files, conversations] = await Promise.all([
        readSubmissions(),
        readRuns(),
        readUsers(),
        readFiles(),
        readConversations(),
      ])
      const allRows = [
        ...perTable.flat(),
        ...submissions,
        ...runs,
        ...users,
        ...files,
        ...conversations,
        ...extraRows,
      ]
      return Promise.all(allRows.map((row) => upsertRow(row))).then(() => undefined)
    }),

  search: (query) => wrap(() => (isSqliteRuntime() ? searchSqlite(query) : searchPostgres(query))),
})
