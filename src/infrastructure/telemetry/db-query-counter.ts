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
 */

import { AsyncLocalStorage } from 'node:async_hooks'

/** Mutable per-request counter box. Mutation is the point of this seam. */
interface CounterBox {
  count: number
}

const storage = new AsyncLocalStorage<CounterBox>()

/**
 * Record one issued DB statement against the current request's box.
 * A no-op outside a counted request (boot, cron, background listeners) —
 * `getStore()` returns `undefined` there, so the counter never leaks across
 * or invents a request context.
 */
export const recordDbQueryIssued = (): void => {
  const box = storage.getStore()
  if (box !== undefined) {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the one sanctioned mutation: synchronous increment of the request-scoped box
    box.count += 1
  }
}

/**
 * The number of DB statements issued so far in the current request, or `0`
 * outside a counted request. Read by the root-span `db.query.count` attribute.
 */
export const currentDbQueryCount = (): number => storage.getStore()?.count ?? 0

/**
 * Run `body` under a fresh query-count box and return its value together with
 * the number of DB statements issued while it ran. The header middleware wraps
 * `next()` in this, unconditionally — only header EMISSION is env-gated, so
 * the span attribute and histogram keep working regardless.
 */
export const withDbQueryCount = async <A>(
  body: () => Promise<A>
): Promise<{ readonly value: A; readonly count: number }> => {
  // eslint-disable-next-line functional/prefer-immutable-types -- the box exists to be incremented synchronously from Drizzle's logQuery callback
  const box: CounterBox = { count: 0 }
  const value = await storage.run(box, body)
  return { value, count: box.count }
}
