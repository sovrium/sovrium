/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AdminSearchRepository,
  AdminSearchDatabaseError,
  type AdminSearchIndexHit,
  type AdminSearchStaleness,
  type AdminSearchUpsertRow,
} from '@/application/ports/repositories/admin-search-repository'
import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { db } from '@/infrastructure/database'
import {
  ADMIN_SEARCH_CONTENT_TABLE,
  ADMIN_SEARCH_FTS_TABLE,
} from '@/infrastructure/database/lookup/admin-search-fts-ddl'
import { makeDbWrap, SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { AdminSearchEntityType } from '@/domain/models/api/admin/search/search'

/**
 * Admin Global Search Repository Implementation — [internal ref].
 *
 * Three raw concerns over the dedicated `_admin_search_index` store:
 *
 *   - `indexStaleness` — `count(*)` + `max(updated_at)` to gate the lazy rebuild.
 *   - `rebuildIndex`   — read each entity kind's EXISTING source (records of the
 *     operator tables, form submissions, automation runs, users, file names,
 *     agent conversations) and upsert one secret-free row per entity, plus the
 *     config-derived connection rows the use case supplies. Idempotent upsert on
 *     `(type, entity_id)`; on PostgreSQL the generated `content_tsv` refreshes
 *     automatically, on SQLite the FTS5 sync triggers fire.
 *   - `search` — the dialect-dispatched full-text query (`content_tsv @@
 *     plainto_tsquery` on PG; an FTS5 `MATCH` join on SQLite).
 *
 * Every per-source read is resilient: a missing/unreadable source table (e.g.
 * an app with no automations) is skipped rather than aborting the rebuild.
 */

/** Wrap a DB promise, adapting failures to AdminSearchDatabaseError. */
const wrap = makeDbWrap((cause) => new AdminSearchDatabaseError({ cause }))

/**
 * A raw SQL fragment naming a `system`-namespaced table for the active dialect:
 *   - Postgres: `system."<logical>"`
 *   - SQLite:   `system_<logical>`
 * Mirrors the `system_` table-prefix / `pgSchema('system')` divergence.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Drizzle `sql.raw()` returns the native mutable SQL shape required for raw interpolation; same rationale as authTableRef.
const systemTableRef = (logical: string): SQL =>
  isSqliteRuntime() ? sql.raw(`system_${logical}`) : sql.raw(`system."${logical}"`)

/** The admin-search content table reference for the active dialect. */
// eslint-disable-next-line functional/prefer-immutable-types -- raw SQL identifier, see systemTableRef
const contentTableRef = (): SQL =>
  isSqliteRuntime() ? sql.raw(ADMIN_SEARCH_CONTENT_TABLE) : sql.raw('system."_admin_search_index"')

/** Coerce an upsert row's `updatedAt` to the column's native form. */
// eslint-disable-next-line functional/prefer-immutable-types -- `Date` is the upstream-mutable JS shape; read-only here (only `.getTime()`), no mutation
const updatedAtValue = (date: Date): number | Date => (isSqliteRuntime() ? date.getTime() : date)

// ─── Per-source readers (each resilient: a bad source yields []) ──────────────

/** Read one operator table's records into index rows (id + first text column label). */
const readTableRecords = (
  displayName: string,
  textColumns: readonly string[]
): Promise<readonly AdminSearchUpsertRow[]> => {
  const physical = sanitizeTableName(displayName)
  // Build a label expression: COALESCE over the text columns, falling back to id.
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

/** Read form submissions into index rows. */
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

/** Read automation runs into index rows. */
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

/** Read users into index rows (email + display name; never a password hash). */
const readUsers = (): Promise<readonly AdminSearchUpsertRow[]> => {
  // eslint-disable-next-line functional/prefer-immutable-types -- Drizzle `sql.raw()` returns the native mutable SQL shape required for raw interpolation; same rationale as systemTableRef
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

/** Read file metadata into index rows (file name only). */
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

/** Read agent conversations into index rows (title/agent only). */
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

/** Upsert one index row (idempotent on `(type, entity_id)`). */
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

// ─── Bounded rebuild fan-outs ─────────────────────────────────────────────────
//
// All three stages of `rebuildIndex` fan out over the SHARED connection pool via
// the `db` facade, and `rebuildIndex` runs INLINE ON THE REQUEST PATH — the
// admin-search use case calls it lazily when `indexStaleness` reports the index
// empty or stale, so it competes with every other in-flight request for the same
// ten default pool slots. Each stage therefore states a ceiling; see
// `SHARED_POOL_FANOUT_CONCURRENCY` for why that ceiling is 2.

/**
 * Read each operator table's records into index rows.
 *
 * FAN-OUT WIDTH: `SHARED_POOL_FANOUT_CONCURRENCY`. The width here is
 * CONFIG-bounded (one `LIMIT 500` read per configured table), which is exactly
 * the provenance the 2026-07-25 incident had and exactly why provenance is not a
 * safety argument: ten configured tables is an ordinary app and ten is the whole
 * pool.
 *
 * ERRORS: `readTableRecords` ends in `.catch(() => [])`, so a missing or
 * unreadable source degrades to an empty contribution and this fan-out never
 * fails. Bounding does not change that — `wrap` only sees a resolved promise.
 *
 * ORDER: `Effect.all` preserves array order exactly as `Promise.all` did, which
 * keeps the `.flat()` in `rebuildIndex` emitting rows in configured-table order.
 */
const readAllTableRecords = (
  tables: ReadonlyArray<{
    readonly displayName: string
    readonly textColumns: readonly string[]
  }>
) =>
  Effect.all(
    tables.map((table) => wrap(() => readTableRecords(table.displayName, table.textColumns))),
    { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
  )

/**
 * Read the five fixed non-table sources into index rows.
 *
 * FAN-OUT WIDTH: `SHARED_POOL_FANOUT_CONCURRENCY`. This tuple is structurally
 * unwidenable — there are exactly five sources and adding a sixth is a code
 * change, not a config change — so it can never GROW into the incident. It is
 * still capped, for two reasons: five concurrent reads is already half the
 * default pool on a request path, and leaving one stage of the rebuild at 5
 * while the other two are at 2 would make 5 the rebuild's real peak and the
 * other two ceilings decorative.
 *
 * ERRORS / ORDER: as above — every reader ends in `.catch(() => [])`, and
 * `Effect.all` preserves the tuple positions the caller destructures.
 */
const readFixedSources = () =>
  Effect.all(
    [
      wrap(readSubmissions),
      wrap(readRuns),
      wrap(readUsers),
      wrap(readFiles),
      wrap(readConversations),
    ],
    { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
  )

/**
 * Upsert every assembled index row (idempotent on `(type, entity_id)`).
 *
 * FAN-OUT WIDTH: `SHARED_POOL_FANOUT_CONCURRENCY`. This is the widest fan-out in
 * the repository layer and the only one whose width is INPUT-SIZE bounded rather
 * than config-bounded: one statement per row, so roughly
 * `500 × |tables| + 5 × 500 + |extraRows|` — thousands of statements for an
 * ordinary app, every one of them competing for a slot in a pool of ten.
 *
 * The previous justification for leaving it unbounded was that "`bun:sqlite`
 * runs the statements synchronously so this is effectively sequential despite
 * the `Promise.all`". That is TRUE ON SQLITE ONLY. On PostgreSQL — `bun:sql`,
 * genuinely async and genuinely pooled, and the engine behind the 2026-07-25
 * outage — the statements were issued all at once and saturated the pool for the
 * whole rebuild. A dialect-specific argument is not a safety argument for a
 * dual-dialect call site.
 *
 * NOT COLLAPSED INTO A MULTI-ROW `INSERT … VALUES (…), (…)`: that would cut the
 * statement count by ~100x, but it is not correct here. `_admin_search_index`
 * carries `unique(type, entity_id)`, and `allRows` reliably contains DUPLICATE
 * keys — every operator table contributes `type: 'record'` with the row's own
 * `id`, so two tables that both have a row `1` both emit `('record', '1')`.
 * One statement per row resolves that collision by last-write-wins; a batched
 * `ON CONFLICT DO UPDATE` cannot, because PostgreSQL rejects a statement that
 * proposes the same conflict key twice ("cannot affect row a second time"). So
 * batching would hard-fail the rebuild for essentially every multi-table app.
 * Collapsing the count is still worth doing, but it needs a de-duplication pass
 * that decides the winner explicitly — a separate change from bounding a width.
 *
 * ORDER: `Effect.all` preserves array order, and bounding makes the duplicate
 * resolution MORE deterministic, not less — statements now issue strictly in
 * array order two at a time, where `Promise.all` issued them all at once and let
 * pool scheduling decide which write landed last.
 *
 * ERRORS: `upsertRow` has no per-row guard, so a single failing statement failed
 * the whole rebuild before and still does — the port surfaces the identical
 * `AdminSearchDatabaseError`, carrying the identical cause. The only difference
 * is that `Effect.all` stops issuing the remaining statements instead of letting
 * them run, so a failed rebuild now writes strictly fewer rows. Nothing depends
 * on that: the upsert is idempotent and the next staleness check re-runs it.
 *
 * The row volume is capped per source (`LIMIT 500`). Every configured app
 * declares at least one searchable entity (a connection, the admin user, …), so
 * the index is never empty after a rebuild — the newest row's `updated_at` IS
 * the freshness marker `indexStaleness` reads.
 */
const upsertAllRows = (rows: readonly AdminSearchUpsertRow[]) =>
  Effect.all(
    rows.map((row) => wrap(() => upsertRow(row))),
    { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
  ).pipe(Effect.asVoid)

// ─── FTS query helpers ────────────────────────────────────────────────────────

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
const toHit = (row: Record<string, unknown>): AdminSearchIndexHit => ({
  type: String(row['type']) as AdminSearchEntityType,
  entityId: String(row['entity_id']),
  title: typeof row['title'] === 'string' ? row['title'] : '',
  href: typeof row['href'] === 'string' ? row['href'] : '',
  updatedAt: row['updated_at'] as Date | string | number,
})

/** Run the SQLite FTS5 search. */
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
 * Admin Global Search Repository Live layer.
 */
export const AdminSearchRepositoryLive = Layer.succeed(AdminSearchRepository, {
  indexStaleness: () =>
    wrap(async (): Promise<AdminSearchStaleness> => {
      const rows = await executeRaw(
        db,
        sql`SELECT COUNT(*) AS row_count, MAX(updated_at) AS last_built
            FROM ${contentTableRef()}`
      )
      const row = rows[0] ?? {}
      const count = toFiniteCount(row['row_count'])
      const lastRaw = row['last_built']
      const lastBuiltAt =
        lastRaw === null || lastRaw === undefined
          ? undefined
          : lastRaw instanceof Date
            ? lastRaw
            : new Date(typeof lastRaw === 'number' ? lastRaw : Number(lastRaw) || String(lastRaw))
      return { isEmpty: count === 0, lastBuiltAt }
    }),

  // Three sequential stages, each a fan-out with a stated ceiling — see the
  // "Bounded rebuild fan-outs" section above. They run one after another, so the
  // rebuild's peak pool usage is the widest single stage, not their sum.
  rebuildIndex: ({ tables, extraRows }) =>
    Effect.gen(function* () {
      const perTable = yield* readAllTableRecords(tables)
      const [submissions, runs, users, files, conversations] = yield* readFixedSources()
      const allRows = [
        ...perTable.flat(),
        ...submissions,
        ...runs,
        ...users,
        ...files,
        ...conversations,
        ...extraRows,
      ]
      // On SQLite each INSERT additionally fires the FTS5 sync triggers.
      yield* upsertAllRows(allRows)
    }),

  search: (query) => wrap(() => (isSqliteRuntime() ? searchSqlite(query) : searchPostgres(query))),
})
