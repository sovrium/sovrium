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
 * again. Measured 2026-09-01 with `SOVRIUM_DB_QUERY_HEADER=on`, both dialects:
 * a list request issued 9 statements, two of them
 * `information_schema.columns` / `pragma_table_info` round-trips answering one
 * question. With this memo it issues 8.
 *
 * ## Why REQUEST scope, and not a process-lifetime cache
 *
 * A longer-lived cache would need invalidating whenever the physical schema
 * moves, and getting that wrong is not a performance bug: a stale `true` emits
 * `WHERE deleted_at IS NULL` against a relation without the column and fails
 * every read, while a stale `false` drops the soft-delete filter and LEAKS
 * deleted rows into listings. Request scope needs no invalidation at all,
 * because it cannot outlive one: every DDL-emitting path in this process runs
 * outside the request path — `runDatabaseStartup` → `initializeSchema` /
 * `reconcileTimestamptzColumns` / `reconcileUserForeignKeys` at boot, and the
 * SIGUSR1 handler, which only refreshes the `X-Sovrium-Config` header hash and
 * touches no schema. Nothing under `presentation/api/` emits DDL.
 *
 * Within one request the memo is also strictly MORE consistent than probing
 * twice: today the page and the count could in principle read two different
 * answers and disagree about whether soft-deleted rows are excluded.
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
 *   (`query-helpers/aggregation-helpers.ts`) consults this. The write path's
 *   own copy (`mutation-helpers/delete-helpers.ts`) still probes fresh on every
 *   call — a narrower blast radius than memoizing `columnExists` itself, which
 *   every catalog caller in the codebase shares.
 * - **Outside a request it is inert.** With no store in scope the memo falls
 *   straight through to a live probe, so boot, cron and the background
 *   listeners are byte-for-byte unchanged.
 * - **A rejected probe is NOT evicted, deliberately.** A probe that fails fails
 *   the transaction that needed it, which fails the whole read — there is no
 *   second consumer left in that request to poison. Eviction was written and
 *   then removed as dead defence; if a future caller starts recovering from a
 *   probe failure mid-request, revisit this rather than trusting it.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { columnExists } from './dialect-introspection'
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
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the one sanctioned mutation: this map IS the request-scoped memo, same shape as the counter box in telemetry/db-query-counter.ts
  box.set(key, pending)
  return pending
}
