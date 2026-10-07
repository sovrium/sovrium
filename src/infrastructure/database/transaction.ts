/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { InTransactionBody } from './drizzle/transaction-body-guard'
import type { DrizzleDB, DrizzleTransaction } from './drizzle/db'

/**
 * Run an Effect inside a database transaction, on the CALLING fiber's services.
 *
 * ## Why this exists
 *
 * Drizzle's `transaction()` takes a plain async callback, so somewhere an
 * Effect has to become a Promise. Doing that with a bare `Effect.runPromise`
 * in the callback body starts one FRESH ROOT fiber per statement, with two
 * consequences:
 *
 *   - **Spans detached.** `traceDbQuery` opens a span on the request's fiber,
 *     but a root fiber starts from `Context.empty()`, so every span the body
 *     opens becomes an orphan root instead of a child of the `http.server`
 *     span it belongs under. The same applies to log annotations and to every
 *     other fiber-scoped reference.
 *   - **Interruption severed.** Interrupting the outer fiber (an aborted HTTP
 *     request, a `Effect.timeout`) cannot reach the root fiber inside the
 *     callback, so the transaction runs to completion against a client that has
 *     already gone away.
 *
 * This module holds the single irreducible `runPromiseWith` for the
 * `table-queries` tree and fixes both, so no caller needs its own.
 *
 * ## What it guarantees
 *
 * **Services and spans propagate.** `Effect.context<R>()` is
 * `withFiber((fiber) => succeed(fiber.context))` — the calling fiber's WHOLE
 * context, not a projection of `R` (the type parameter is a cast; see
 * `vendor/effect/packages/effect/src/internal/effect.ts:2146`). The current span
 * rides in that context: `Tracer.ParentSpan` is declared as
 * `Context.Service<ParentSpan, AnySpan>()(ParentSpanKey, { fiberCached: true })`
 * (`vendor/effect/packages/effect/src/Tracer.ts:170`). Handing that context to
 * `runPromiseWith` therefore reattaches the body's spans under the caller's,
 * and satisfies the body's `R` from the caller's services rather than requiring
 * `R = never`.
 *
 * **Error identity survives.** `Effect.runPromiseWith` ends with
 * `throw causeSquash(exit.cause)`
 * (`vendor/effect/packages/effect/src/internal/effect.ts:5474-5479`), so a typed
 * failure crosses the Drizzle boundary as ITSELF and reaches `onTransactionFailure`
 * intact — which is what lets the `instanceof DatabaseError` / `instanceof
 * ValidationError` checks in `shared/error-handling.ts` keep working. This is
 * also why the hand-rolled `Cause.squash` re-throw that `runEffectInTx` carried
 * is no longer needed: it reimplemented, for Effect 3, what Effect 4's runner
 * now does itself. (Its docstring claimed `Effect.runPromise` wraps failures in
 * a `FiberFailure`; in Effect 4 `runPromise` IS `runPromiseWith(Context.empty())`,
 * so it squashes too. Pinned by `transaction.test.ts`.)
 *
 * **Rollback still happens on failure.** The squashed cause is thrown OUT of the
 * Drizzle callback, which is what makes the driver issue its `ROLLBACK`. A
 * design that returned the failure as a typed `Effect` value instead would
 * COMMIT the transaction and then report an error.
 *
 * ## What it does NOT guarantee about interruption
 *
 * Interrupting the caller aborts the `AbortSignal` that `Effect.tryPromise`
 * hands its thunk; `runForkWith` registers that signal and calls
 * `fiber.interruptUnsafe()` on it
 * (`vendor/effect/packages/effect/src/internal/effect.ts:5380-5386`). So:
 *
 *   - the body stops at its next interruptible point, and the resulting
 *     interrupt is squashed into a throw, so **the transaction is rolled back**
 *     rather than left running. That is the behaviour change worth having.
 *   - the driver statement ALREADY ON THE WIRE is not cancelled — neither
 *     `bun:sql` nor `bun:sqlite` exposes a per-statement cancel — so
 *     interruption is observed between statements, not within one.
 *   - the caller's fiber completes as interrupted IMMEDIATELY; it does not wait
 *     for the rollback round-trip, which finishes on the abandoned promise.
 *
 * The signal only reaches the thunk because the thunk DECLARES the parameter:
 * `Effect.tryPromise` passes it through `callbackOptions(..., f.length !== 0)`
 * (same file, :1078), so writing `try: () => …` would silently disable all of
 * the above. Do not drop the `signal` argument below.
 *
 * ## SQLite
 *
 * The stock `drizzle-orm/bun-sqlite` transaction is SYNCHRONOUS
 * (`vendor/drizzle-orm/drizzle-orm/src/bun-sqlite/session.ts:99-110`): an async
 * callback returns a pending Promise at its first `await`, the native wrapper
 * commits right then, and the remaining statements run in autocommit. That is
 * why the runtime SQLite client is not the stock one: `sqlite-serialized-client.ts`
 * opens `BEGIN IMMEDIATE … COMMIT`/`ROLLBACK` by hand around the whole body and
 * serialises it against every other statement on the single shared connection,
 * so a body here is all-or-nothing on both engines and no other request's write
 * is captured by it. The one rule it adds: a body issues its statements through
 * `tx`, never through the shared `db`, which would wait for the very
 * transaction it is part of. The body runs with `InTransactionBody` set, so on
 * SQLite a body that reaches the shared `db` — directly or through a helper —
 * fails at once with a message naming this rule instead of hanging
 * (`drizzle/transaction-body-guard.ts`).
 *
 * @param database - the Drizzle client to open the transaction on
 * @param body - the work to run against the transaction handle
 * @param onTransactionFailure - maps anything the transaction rejects with (a
 *   squashed body failure, or a driver/rollback error) onto the caller's error
 *   channel. Every call site passes one of the `shared/error-handling.ts`
 *   wrappers, which return a known error unchanged.
 * @returns the body's value, or `onTransactionFailure`'s error
 */
export const withTransaction = <A, E, R, E2>(
  database: Readonly<DrizzleDB>,
  body: (tx: Readonly<DrizzleTransaction>) => Effect.Effect<A, E, R>,
  onTransactionFailure: (error: unknown) => E2
): Effect.Effect<A, E2, R> =>
  Effect.flatMap(Effect.context<R>(), (services) =>
    Effect.tryPromise({
      try: (signal) =>
        database.transaction((tx) =>
          Effect.runPromiseWith(services)(
            Effect.provideService(body(tx), InTransactionBody, true),
            { signal }
          )
        ),
      catch: onTransactionFailure,
    })
  )
