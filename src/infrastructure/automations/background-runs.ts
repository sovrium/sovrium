/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/immutable-data, functional/prefer-immutable-types, functional/no-expression-statements, drizzle/enforce-delete-with-where -- the set of in-flight background runs is process state that must mutate in place, like the run scheduler's queues (`run/scheduler.ts`); `Set.delete` is not a SQL delete */

/**
 * The automation runs a write started in the BACKGROUND, held so a shutdown
 * can wait for them ([internal ref], standing rule E3).
 *
 * A record an automation step writes starts the record automations of its
 * table, and that dispatch does not wait (`run/record-event-channel.ts`
 * explains why). Such a run was a root fiber nothing owned: stopping the
 * server exited the process under it and left it `running` in run history
 * forever. Every such run now registers its fiber here for as long as it
 * runs, and the listener's stop (`createStopEffect`) drains the set AFTER the
 * socket closes and BEFORE the services behind the runs are released: each run
 * either finishes inside the grace window, or is interrupted — which closes its
 * row as stopped by the shutdown (`run/defect-finaliser.ts`) — never dropped.
 *
 * Process-wide rather than per-server on purpose: a background run outlives
 * the request that started it and belongs to the process that will exit.
 */

import { Effect, Fiber } from 'effect'

const inFlight: Set<Fiber.Fiber<unknown, unknown>> = new Set()

/**
 * Run `program` as a tracked background run: its fiber is held from start to
 * exit, so a shutdown can wait for it or interrupt it.
 */
export const trackBackgroundRun = <A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.withFiber((fiber) =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        inFlight.add(fiber)
      }),
      () => program,
      () =>
        Effect.sync(() => {
          inFlight.delete(fiber)
        })
    )
  )

/**
 * Wait up to `graceMs` for every tracked background run to finish, then
 * interrupt the ones still going — each closes its run as stopped by the
 * shutdown. Returns at once when none is in flight.
 */
export const drainBackgroundRuns = (graceMs: number): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (inFlight.size === 0) return
    // A timeout is the expected way out, not a failure: the runs still going
    // are interrupted below.
    yield* Fiber.awaitAll([...inFlight]).pipe(Effect.timeoutOption(graceMs))
    const remaining = [...inFlight]
    if (remaining.length > 0) yield* Fiber.interruptAll(remaining)
  })
