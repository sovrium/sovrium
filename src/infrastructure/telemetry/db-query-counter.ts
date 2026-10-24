/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-request DB query-count seam (`AsyncLocalStorage`-based).
 *
 * Turns "how many SQL statements did serving this request issue?" into a
 * deterministic, per-request number that the header middleware
 * (`server/middleware/db-query-count-header.ts`), the root-span attribute
 * (`server/run-request-effect.ts`), and the `db.query.per_request` histogram
 * (`metrics.ts`) all read from ONE source of truth.
 *
 * ## Why `AsyncLocalStorage` and not an Effect primitive
 *
 * The producer is `Logger.logQuery` — a plain SYNCHRONOUS callback invoked by
 * Drizzle's driver sessions with no fiber in scope, so no Effect context can
 * reach it. Effect v4 has no `FiberRef`, and `Context.Reference` memoizes its
 * `defaultValue()` onto the reference object itself (one box shared
 * process-wide — measured, not guessed). ALS is the only mechanism that spans
 * both worlds: the Hono middleware opens a box per request, and every
 * synchronous or promise-continuation frame under it — including Effect fiber
 * steps, which schedule on their own request's per-fiber dispatcher — sees
 * that request's box and no other. Verified across 3 interleaved concurrent
 * requests exercising `yieldNow` / `forkChild` / `sleep` /
 * `Effect.all({ concurrency: "unbounded" })`: exact counts, zero orphans, on
 * BOTH dialects (see `db-query-counter.test.ts` and
 * `database/drizzle/db-query-count.test.ts`).
 *
 * ## Coverage
 *
 * With `RAG_SQLITE_VEC` unset (the default), the Drizzle `countingLogger`
 * (`database/drizzle/db-bun.ts`) observes 100% of request-path SQL issued by
 * application code and by Better Auth (whose `drizzleAdapter` consumes the
 * same `db` proxy), on both dialects. It does NOT observe driver-issued
 * transaction control — on Postgres, `BEGIN`/`COMMIT`/`ROLLBACK` are issued by
 * `client.begin` and never route through a `PreparedQuery`; on SQLite,
 * NESTED-transaction `savepoint` statements DO route through the session and
 * are counted. The one raw-handle blind spot — `sqlite-vec-search.ts`, active
 * only under `RAG_SQLITE_VEC=on` — calls {@link recordDbQueryIssued} at its
 * three query sites explicitly.
 *
 * ## Known limitations (deliberate)
 *
 * - Fire-and-forget work that resolves AFTER the response was snapshotted
 *   increments the box post-snapshot; the header/metric report the count at
 *   response time.
 * - SSE routes count only the queries issued up to first byte — the middleware
 *   unwinds before the stream body is produced.
 * - {@link withDbQueryCount} opens a FRESH box: a nested call counts
 *   independently and does not add to the outer box. The header middleware is
 *   the only production caller, so nesting does not occur on the request path.
 *   {@link withDbCostBox} (the scheduled-run wrapper) opens one only when none
 *   is current, so it never splits a request's count.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { Effect, Fiber } from 'effect'

/** Mutable per-request counter box. Mutation is the point of this seam. */
interface CounterBox {
  count: number
  /** Rows the database handed back to the process (see {@link recordDbRowsReturned}). */
  rows: number
  /** Transactions opened (see {@link recordDbTransactionOpened}). */
  transactions: number
  /** Statements that read the database catalog (see {@link isCatalogProbe}). */
  catalogProbes: number
}

const storage = new AsyncLocalStorage<CounterBox>()

const newBox = (): CounterBox => ({ count: 0, rows: 0, transactions: 0, catalogProbes: 0 })

/**
 * Whether a statement reads the database catalog rather than application
 * data: PostgreSQL's `information_schema` / `pg_catalog`, SQLite's
 * `sqlite_master` / `sqlite_schema` and its `pragma_table_info` /
 * `pragma_table_xinfo` table-valued functions (the SQLite record read path
 * asks for a table's columns through `pragma_table_xinfo`). A lookup like this
 * repeated on every run is a cost the statement count alone cannot name.
 *
 * The match is on the statement's SHAPE, not the bare word: the schema names
 * must qualify a relation (`information_schema.` / `pg_catalog.`), the pragma
 * functions must be called, and none may be quoted. Every application
 * identifier reaches SQL double-quoted, so a table or column called
 * `"pg_catalog_notes"` or `"information_schema"` is never counted. A string
 * literal holding a catalog reference still would be; values are bound
 * parameters, so none reaches the statement text in practice.
 */
const CATALOG_PROBE_PATTERN =
  /(?<![\w"'`])(?:(?:information_schema|pg_catalog)\s*\.|(?:sqlite_master|sqlite_schema)(?![\w"'`])|pragma_table_x?info\s*\()/i

/** Whether `statement` reads the database catalog (see {@link CATALOG_PROBE_PATTERN}). */
export const isCatalogProbe = (statement: string): boolean => CATALOG_PROBE_PATTERN.test(statement)

/**
 * Record one issued DB statement against the current request's box, and count
 * it as a catalog lookup too when its text reads the catalog. A no-op outside
 * a counted request or run (boot, background listeners) — `getStore()` returns
 * `undefined` there, so the counter never leaks across or invents a context.
 */
export const recordDbQueryIssued = (statement?: string): void => {
  const box = storage.getStore()
  if (box !== undefined) {
    box.count += 1
    if (statement !== undefined && isCatalogProbe(statement)) {
      box.catalogProbes += 1
    }
  }
}

/**
 * Record one opened transaction against the current box. Called once per
 * `withTransaction` (`database/transaction.ts`), whatever the dialect: the
 * driver's own `BEGIN`/`COMMIT` never reach the statement logger on
 * PostgreSQL, so this is the one place a transaction is visible on both.
 */
export const recordDbTransactionOpened = (): void => {
  const box = storage.getStore()
  if (box !== undefined) {
    box.transactions += 1
  }
}

/**
 * Record `rows` rows returned by the database against the current request's
 * box — the second half of the seam, read by `X-Sovrium-Db-Rows`.
 *
 * The statement count cannot tell "read one page" from "read the whole table":
 * both are one `SELECT`. What differs is how many rows come back, so the
 * raw-SQL funnel every record read goes through (`executeRaw`,
 * `database/sql/dialect-execute.ts`) reports each result's length here. Rows
 * read through the query builder (sessions, roles, Better Auth) are not
 * counted: they are a constant per request and say nothing about a table's
 * size. A no-op outside a counted request, like {@link recordDbQueryIssued}.
 */
export const recordDbRowsReturned = (rows: number): void => {
  const box = storage.getStore()
  if (box !== undefined) {
    box.rows += rows
  }
}

/**
 * The number of DB statements issued so far in the current request, or `0`
 * outside a counted request. Read by the root-span `db.query.count` attribute.
 */
export const currentDbQueryCount = (): number => storage.getStore()?.count ?? 0

/** A snapshot of the three database-cost counters of the current box. */
export interface DbCostSnapshot {
  readonly statements: number
  readonly transactions: number
  readonly catalogProbes: number
}

/**
 * The current box's statement, transaction and catalog-lookup counts, or
 * `undefined` outside any box. Read twice by the automation-run seam, before
 * and after a run, so the run is charged its own work and not the request's
 * around it (`automation-run-trace.ts`).
 */
export const currentDbCost = (): DbCostSnapshot | undefined => {
  const box = storage.getStore()
  return box === undefined
    ? undefined
    : { statements: box.count, transactions: box.transactions, catalogProbes: box.catalogProbes }
}

/**
 * Run `effect` under a counter box, opening a fresh one only when none is
 * current: a run inside a request keeps counting into the request's box (the
 * request header and root span stay whole), while a scheduled run — which has
 * no request around it — gets a box of its own. The effect runs on the
 * caller's services and spans, and its exit, failure included, is handed back
 * unchanged.
 *
 * Why a forked fiber: an Effect fiber captures the async context when it
 * yields and restores it when it resumes, so the box must be current at the
 * moment the fiber STARTS. The effect is therefore forked inside
 * `storage.run`, on the caller's services, and its exit resumes the caller.
 * Interrupting the caller interrupts the fork and waits for its finalizers
 * (a transaction's rollback included) before the caller unwinds.
 */
export const withDbCostBox = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.flatMap(Effect.context<R>(), (services) =>
    storage.getStore() === undefined
      ? Effect.callback<A, E>((resume) => {
          const fiber = storage.run(newBox(), () => Effect.runForkWith(services)(effect))
          fiber.addObserver(resume)
          return Fiber.interrupt(fiber)
        })
      : effect
  )

/**
 * Run `body` under a fresh query-count box and return its value together with
 * the number of DB statements issued (and rows returned) while it ran. The header middleware wraps
 * `next()` in this, unconditionally — only header EMISSION is env-gated, so
 * the span attribute and histogram keep working regardless.
 */
export const withDbQueryCount = async <A>(
  body: () => Promise<A>
): Promise<{
  readonly value: A
  readonly count: number
  readonly rows: number
  readonly transactions: number
  readonly catalogProbes: number
}> => {
  const box = newBox()
  const value = await storage.run(box, body)
  return {
    value,
    count: box.count,
    rows: box.rows,
    transactions: box.transactions,
    catalogProbes: box.catalogProbes,
  }
}
