/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared `Effect.tryPromise` adapter for repository-live implementations.
 *
 * Every `*-repository-live.ts` file wraps each port method in the identical
 * shape — a Promise-returning Drizzle query in `try`, and a `catch` that
 * adapts the unknown failure into that repository's tagged `*DatabaseError`:
 *
 * ```ts
 * method: (input) =>
 *   Effect.tryPromise({
 *     try: () => methodImpl(input),
 *     catch: (cause) => new XDatabaseError({ cause }),
 *   })
 * ```
 *
 * The only thing that varies per repository is the tagged-error constructor.
 * `dbEffect` factors out the `Effect.tryPromise` boilerplate; `makeDbWrap`
 * binds a single error adapter so a repository can write
 * `wrap(() => db.select()…)` instead of repeating the `{ try, catch }`
 * object at every call site.
 *
 * A change to error-wrapping policy (a log line, a query label, a span)
 * now happens here once instead of across ~108 call sites.
 */

import { Effect } from 'effect'

/**
 * Width of a repository fan-out that runs on the SHARED connection pool.
 *
 * This module defines the boundary (`wrap` / `dbEffect`); it also defines the
 * ceiling you must state when you fan out ACROSS that boundary. The two belong
 * together — `sovrium/no-unbounded-promise-fanout` is configured with
 * `{ boundaries: ['wrap', 'dbEffect'] }` precisely because a `wrap(async () =>
 * Promise.all(...))` is the same hazard as the literal `Effect.tryPromise` shape
 * that caused a production 504 incident (2026-07-25).
 *
 * Why a ceiling at all — every branch of a fan-out through the `db` facade takes
 * a slot from ONE pool. `DEFAULT_DATABASE_POOL_MAX` is 10
 * (`domain/models/process-env/database/database-dialect.ts`), so a fan-out of 10 is
 * total starvation: the incident's request held every connection and three
 * unrelated endpoints — including ones that only needed a session lookup —
 * timed out together.
 *
 * Why 2 — it leaves eight of the ten default slots for the rest of the process,
 * which is what keeps a repository roll-up from starving the auth middleware. It
 * matches the DB-bound precedent in `database/views/view-generators.ts`, the
 * per-table budget in
 * `database/repositories/tables/tables-overview-repository-live.ts`, and
 * `BATCH_FANOUT_CONCURRENCY` in `table-queries/batch/batch-helpers.ts`.
 *
 * Note the DELIBERATE trade: a bounded fan-out is slower than an unbounded one.
 * That is the trade the incident says to make — a roll-up that takes longer but
 * cannot starve co-firing requests is strictly better than a fast one that can.
 * Latency is bounded by the request timeout; pool exhaustion is bounded by
 * nothing.
 *
 * Do NOT reuse this for work that rides a transaction's own reserved connection
 * (see `BATCH_FANOUT_CONCURRENCY`, a different argument) or a dedicated
 * boot-time connection (see `schema/schema-initializer-execute.ts`, which is
 * legitimately unbounded).
 *
 * Full rationale and the decision criteria for choosing a width:
 * `[internal ref]`.
 */
export const SHARED_POOL_FANOUT_CONCURRENCY = 2

/**
 * Wrap a Promise-returning database operation in an Effect, adapting any
 * thrown/rejected failure through `toError`.
 *
 * @param toError - Adapts the unknown failure cause into a typed error `E`.
 * @param run - The Promise-returning database operation.
 */
export const dbEffect = <A, E>(
  toError: (cause: unknown) => E,
  run: () => Promise<A>
): Effect.Effect<A, E> => Effect.tryPromise({ try: run, catch: toError })

/**
 * Build a repository-scoped `wrap` helper bound to a single error adapter.
 *
 * @example
 * ```ts
 * const wrap = makeDbWrap((cause) => new XDatabaseError({ cause }))
 * // ...
 * method: (input) => wrap(() => methodImpl(input))
 * ```
 */
export const makeDbWrap =
  <E>(toError: (cause: unknown) => E) =>
  <A>(run: () => Promise<A>): Effect.Effect<A, E> =>
    dbEffect(toError, run)
