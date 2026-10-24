/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Request-scoped memo for catalog probes (`AsyncLocalStorage`-based).
 *
 * ## The cost this removes
 *
 * Serving one record listing asks the database catalog the SAME question
 * twice. `listRecords` probes `deleted_at` to build its `WHERE` clause
 * (`crud-read.ts`), and the `COUNT(*)` that answers `pagination.total` runs
 * through `computeAggregations`, which builds the identical clause and probes
 * again. Measured with `SOVRIUM_DB_QUERY_HEADER=on`, both dialects:
 * a list request issued 9 statements, two of them
 * `information_schema.columns` / `pragma_table_info` round-trips answering one
 * question. With this memo it issues 8.
 *
 * ## Request scope, and the process-lifetime column cache beneath it
 *
 * A longer-lived cache needs invalidating whenever the physical schema moves,
 * and getting that wrong is not a performance bug: a stale `true` emits
 * `WHERE deleted_at IS NULL` against a relation without the column and fails
 * every read, while a stale `false` drops the soft-delete filter and LEAKS
 * deleted rows into listings. That cache now exists, one level down: the
 * column lists `listTableColumns` answers are kept per process and replaced by
 * the only writers of columns — the schema initializer (before and after it
 * runs) and the migrations — and an empty answer is never kept. This memo
 * stays on top of it for the duration of one request, so the page and the
 * count of one listing read one answer.
 *
 * ## Why not read the answer off the app config instead
 *
 * Soft-delete-by-default gives every declared table a `deleted_at`, so it is
 * tempting to drop the probe entirely and save both round-trips. It does not
 * hold: a table carrying `lookup`, `rollup` or `count` fields is served through
 * a database VIEW of the same name over a `{table}_base` table
 * (`database/lookup/`), so the real question is whether that VIEW projects the
 * column — a property of the view generator, not of the config. An inference
 * here would be wrong in the direction that leaks rows.
 *
 * ## Why `AsyncLocalStorage`
 *
 * Same reason as `telemetry/db-query-counter.ts`, whose header comment carries
 * the full argument: Effect v4 has no `FiberRef`, and `Context.Reference`
 * memoizes its default onto the reference object — one box shared
 * process-wide. The probes here sit inside `db.transaction(async tx => …)`
 * callbacks reached through `Effect.tryPromise`, i.e. plain promise
 * continuations with no fiber in scope. ALS is what spans both worlds, and the
 * query counter has already demonstrated it attributes correctly across
 * interleaved concurrent requests on both dialects.
 *
 * ## Deliberate limits
 *
 * - **Reads only.** Only the read path's `checkDeletedAtColumn`
 *   (`query-helpers/aggregation-helpers.ts`) consults this request memo. Every
 *   other catalog caller — the write path's `mutation-helpers/delete-helpers.ts`
 *   and the GDPR erasure included — shares the per-process column cache
 *   beneath it, which `columnExists` reads.
 * - **Outside a request it falls through to the column cache.** With no store
 *   in scope the memo asks {@link columnExists}, whose column list comes from
 *   the per-process cache in `dialect-introspection.ts` (`listTableColumns`)
 *   after its first lookup, so a scheduled run or a background listener stops
 *   asking the catalog on every read too. That cache is replaced by the
 *   schema initializer and the migrations, the only writers of columns.
 * - **A rejected probe is NOT evicted, deliberately.** A probe that fails fails
 *   the transaction that needed it, which fails the whole read — there is no
 *   second consumer left in that request to poison. Eviction was written and
 *   then removed as dead defence; if a future caller starts recovering from a
 *   probe failure mid-request, revisit this rather than trusting it.
 * - **A read that names a column the database no longer has is retried once**
 *   ({@link retryOnceOnStaleColumns}) with this memo and the per-process
 *   column cache both forgotten — the one way a cached answer can outlive DDL
 *   issued by ANOTHER process (`sovrium migrate`, an import or a restore run
 *   against the live database). A stale list can only add a column that is
 *   gone, which fails loudly and heals here; a column added elsewhere is
 *   simply not read until the next reset, as an old config would not read it.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { Effect } from 'effect'
import { collectCauseChain, readSqlState } from '@/domain/errors/driver-failure'
import { columnExists, resetTableColumnCache } from './dialect-introspection'
import type { RawSqlRunner } from './dialect-execute'

/**
 * Per-request memo. Values are the in-flight PROMISE, not the resolved boolean,
 * so two probes racing inside one request share one round-trip instead of both
 * missing an as-yet-unpopulated cache.
 */
type CatalogBox = Map<string, Promise<boolean>>

const storage = new AsyncLocalStorage<CatalogBox>()

/** Space separator: a validated table/column name never contains one. */
const cacheKey = (tableName: string, columnName: string): string => `${tableName} ${columnName}`

/**
 * Run `body` under a fresh catalog memo. Mounted once per request by
 * `server/middleware/catalog-request-cache.ts`.
 */
export const withCatalogRequestCache = <A>(body: () => Promise<A>): Promise<A> =>
  storage.run(new Map(), body)

/**
 * {@link columnExists}, answered once per (table, column) per request.
 *
 * Outside a request this is {@link columnExists} verbatim.
 */
export const cachedColumnExists = (
  runner: Readonly<RawSqlRunner>,
  tableName: string,
  columnName: string
): Promise<boolean> => {
  const box = storage.getStore()
  if (box === undefined) return columnExists(runner, tableName, columnName)

  const key = cacheKey(tableName, columnName)
  const hit = box.get(key)
  if (hit !== undefined) return hit

  const pending = columnExists(runner, tableName, columnName)
  box.set(key, pending)
  return pending
}

/** PostgreSQL `undefined_column`; SQLite has no code for it, only its message. */
const UNDEFINED_COLUMN_SQLSTATE = '42703'

/**
 * Whether `error` (or anything on its cause chain) is the database refusing a
 * column it does not have: SQLSTATE 42703 on PostgreSQL, `no such column` on
 * SQLite.
 */
export const isUndefinedColumnFailure = (error: unknown): boolean =>
  collectCauseChain(error).some(
    (node) =>
      readSqlState(node) === UNDEFINED_COLUMN_SQLSTATE ||
      (typeof node.message === 'string' && node.message.includes('no such column'))
  )

/**
 * Run a READ, and when it fails on a column the database does not have, forget
 * every cached catalog answer (this request's memo and the per-process column
 * cache) and run it once more. Reads only: a retry must be harmless to repeat.
 * A column that is genuinely unknown fails the second run the same way.
 */
export const retryOnceOnStaleColumns = <A, E, R>(
  read: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  read.pipe(
    Effect.catchIf(isUndefinedColumnFailure, () =>
      Effect.sync(() => {
        storage.getStore()?.clear()
        resetTableColumnCache()
      }).pipe(Effect.andThen(read))
    )
  )
