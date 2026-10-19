/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AdminSearchRepository,
  AdminSearchDatabaseError,
  type AdminSearchStaleness,
  type AdminSearchUpsertRow,
} from '@/application/ports/repositories/admin-search-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { db } from '@/infrastructure/database'
import { makeDbWrap, SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  readConversations,
  readFiles,
  readRuns,
  readSubmissions,
  readUsers,
} from './admin-search-fixed-sources'
import { adminSearchContentTableRef, pruneAdminIndex, searchAdminIndex } from './admin-search-query'
import { recordIndexKey } from './admin-search-record-key'

/**
 * Admin Global Search Repository Implementation.
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

/** Coerce an upsert row's `updatedAt` to the column's native form. */
const updatedAtValue = (date: Date): number | Date => (isSqliteRuntime() ? date.getTime() : date)

// ─── Per-source readers (each resilient: a bad source yields []) ──────────────
//
// A title holds the entity's own name and never a word for its KIND: the index
// is built once and read by operators in every language, so the kind travels as
// `type` and is named at read time, in the reader's language.

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
        entityId: recordIndexKey(displayName, String(row['entity_id'])),
        title: typeof row['title'] === 'string' ? row['title'] : String(row['entity_id']),
        body: '',
        href: `/_admin/records/${displayName}?record=${encodeURIComponent(String(row['entity_id']))}`,
        updatedAt: new Date(),
      }))
    )
    .catch(() => [])
}

/** Upsert one index row (idempotent on `(type, entity_id)`). */
const upsertRow = (row: AdminSearchUpsertRow): Promise<unknown> =>
  executeRaw(
    db,
    sql`INSERT INTO ${adminSearchContentTableRef()} (type, entity_id, title, body, href, updated_at)
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
 * the provenance a production pool-exhaustion incident had, and exactly why provenance is not a
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
  Effect.forEach(
    tables,
    (table) => wrap(() => readTableRecords(table.displayName, table.textColumns)),
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
const readFixedSources = (formTitles: Readonly<Record<string, string>>, now: Readonly<Date>) =>
  Effect.all(
    [
      wrap(() => readSubmissions(formTitles, now)),
      wrap(() => readRuns(now)),
      wrap(() => readUsers(now)),
      wrap(() => readFiles(now)),
      wrap(() => readConversations(now)),
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
 * The tempting argument for leaving it unbounded — "`bun:sqlite` runs the
 * statements synchronously so this is effectively sequential despite the
 * `Promise.all`" — is TRUE ON SQLITE ONLY. On PostgreSQL — `bun:sql`, genuinely
 * async and genuinely pooled, and the engine behind a production outage — the
 * statements would be issued all at once and saturate the pool for the whole
 * rebuild. A dialect-specific argument is not a safety argument for a
 * dual-dialect call site.
 *
 * NOT COLLAPSED INTO A MULTI-ROW `INSERT … VALUES (…), (…)`: that would cut the
 * statement count by ~100x, but it is not correct here. `_admin_search_index`
 * carries `unique(type, entity_id)`, and the config-derived rows are not
 * de-duplicated against the sources (records are keyed `table:id`, so tables do
 * not collide). One statement per row resolves a collision by last-write-wins; a batched
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
  Effect.forEach(rows, (row) => wrap(() => upsertRow(row)), {
    concurrency: SHARED_POOL_FANOUT_CONCURRENCY,
  }).pipe(Effect.asVoid)

/**
 * Admin Global Search Repository Live layer.
 */
export const AdminSearchRepositoryLive = Layer.succeed(AdminSearchRepository, {
  indexStaleness: wrap(async (): Promise<AdminSearchStaleness> => {
    const rows = await executeRaw(
      db,
      sql`SELECT COUNT(*) AS row_count, MAX(updated_at) AS last_built
            FROM ${adminSearchContentTableRef()}`
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
  rebuildIndex: ({ tables, extraRows, formTitles, producedKinds, configKinds }) =>
    Effect.gen(function* () {
      const now = new Date()
      const perTable = yield* readAllTableRecords(tables)
      const [submissions, runs, users, files, conversations] = yield* readFixedSources(
        formTitles,
        now
      )
      const allRows = [
        ...perTable.flat(),
        ...submissions,
        ...runs,
        ...users,
        ...files,
        ...conversations,
        ...extraRows,
      ]
      // On SQLite each INSERT/DELETE additionally fires the FTS5 sync triggers.
      yield* upsertAllRows(allRows)
      yield* wrap(() => pruneAdminIndex({ producedKinds, configKinds, configRows: extraRows }))
    }),

  search: (query) => wrap(() => searchAdminIndex(query)),
})
