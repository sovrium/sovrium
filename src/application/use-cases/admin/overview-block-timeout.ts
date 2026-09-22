/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-block latency guard for the cross-domain admin overview roll-up
 * (`buildAdminOverview`, `GET /api/admin/overview`).
 *
 * The roll-up fans six per-domain projections out concurrently, and each one
 * already ends in `Effect.catch(() => zeroBlock)` — so a domain that *fails*
 * degrades to its zero tile. That covers FAILURE but NOT LATENCY: `catchAll`
 * rescues errors, not slowness, so a domain that is merely slow in production
 * can still push the whole concurrent request past the Hono `API_TIMEOUT_MS`
 * (30s) ceiling → a 504 (observed on the live Partner deployment right after
 * admin login).
 *
 * `withBlockTimeout` adds the missing LATENCY bound: it is a pure pass-through
 * on the fast path (returns the effect's value unchanged) and, on the slow
 * path, substitutes the caller-supplied `zero` instead of hanging. Composed
 * with the existing `catchAll`, every block is now bounded on BOTH axes — a
 * failed source zeroes via `catchAll`, a slow source zeroes via
 * `withBlockTimeout` — so the assembled roll-up still `never`-fails AND now
 * `never`-hangs.
 *
 * The blocks are already `never`-error (each ends in `catchAll`), so wrapping
 * the whole block is correct: slowness → zero via the timeout, failure → zero
 * via the block's own `catchAll`. `ms` stays an explicit parameter so the
 * combinator is unit-testable in isolation (see `overview-block-timeout.test.ts`).
 *
 * Uses the codebase `Effect.timeoutOrElse` idiom (see
 * `application/use-cases/automations/run/step-executor.ts`).
 */

import { Duration, Effect } from 'effect'

/**
 * Bound an already-`never`-error block by latency: return its resolved value if
 * it settles before `ms`, otherwise resolve to `zero`. The wrapper bounds
 * LATENCY only — it never changes a fast effect's value, and its only job on the
 * slow path is to substitute `zero`. Failure handling is out of scope (the
 * caller's `catchAll` owns that path).
 */
export const withBlockTimeout = <A, R>(
  effect: Effect.Effect<A, never, R>,
  zero: A,
  ms: number
): Effect.Effect<A, never, R> =>
  // EFFECT 4: `timeoutTo({duration, onSuccess, onTimeout})` -> `timeoutOrElse`,
  // whose fallback is an EFFECT rather than a plain value
  // (migration/v3-to-v4.md:9837). `onSuccess` was the identity here, so no
  // `Effect.map` is required.
  Effect.timeoutOrElse(effect, {
    duration: Duration.millis(ms),
    orElse: (): Effect.Effect<A> => Effect.succeed(zero),
  }).pipe(Effect.withSpan('admin.with-block-timeout'))
