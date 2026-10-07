/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A deadline counted in AWAKE time, so a suspended host cannot spend it.
 *
 * ## The defect this exists for
 *
 * On 2026-10-06 a `bun run quality` on a MacBook printed
 * `Prettier timed out after 2.8m (15.1s)` — a 168 s budget reported as
 * exceeded by a step that had run for fifteen seconds. Nothing in the budget
 * arithmetic was wrong. The two numbers came from two clocks:
 *
 * - the DEADLINE was `Effect.timeoutOrElse`, i.e. a `setTimeout`, and Bun's
 *   timers run on `CLOCK_MONOTONIC` — which on macOS keeps counting while the
 *   machine sleeps (`vendor/bun/src/bun_core/util.rs`, `Timespec::now_real`);
 * - the DURATION was `Effect.timed`, i.e. `process.hrtime`, which Bun reads off
 *   a Rust `Instant` — `CLOCK_UPTIME_RAW` on macOS, which stops while the
 *   machine sleeps.
 *
 * `pmset -g log` for that minute shows the host in and out of Maintenance
 * Sleep (`Sleep … 54 secs`, then `Sleep … 1053 secs`) between short
 * `DarkWake`s. The step got ~15 s of CPU; the timer saw minutes of wall time
 * and fired on the next wake. Prettier was frozen with the rest of the machine
 * for every one of those minutes, so the step was not slow — it was asleep.
 *
 * ## What this does instead
 *
 * Sleeps for the remaining budget, then re-reads the monotonic clock the
 * duration is measured by, and sleeps again for whatever is left. A timer that
 * fires early by that clock — because the host was suspended under it — is
 * re-armed rather than believed. So a deadline can never be reported as
 * exceeded before the step has been AWAKE for its whole budget, and the
 * duration a timeout prints can no longer be smaller than the budget it names.
 *
 * A genuine hang still ends: awake time advances whenever the process can run.
 */

import * as Clock from 'effect/Clock'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'

const NANOS_PER_MILLI = 1_000_000

/** Sleep until `budgetNanos` of monotonic (awake) time has passed since `start`. */
const sleepUntil = (start: bigint, budgetNanos: bigint): Effect.Effect<void> =>
  Effect.flatMap(Clock.monotonicTimeNanos, (now) => {
    const remaining = budgetNanos - (now - start)
    return remaining <= BigInt(0)
      ? Effect.void
      : Effect.flatMap(Effect.sleep(Duration.nanos(remaining)), () =>
          sleepUntil(start, budgetNanos)
        )
  })

/**
 * Complete once `duration` of AWAKE time has elapsed — measured on the same
 * monotonic clock `Effect.timed` uses, so a deadline and the duration printed
 * beside it can never disagree.
 */
export const sleepAwake = (duration: Duration.Duration): Effect.Effect<void> =>
  Effect.flatMap(Clock.monotonicTimeNanos, (start) =>
    sleepUntil(start, BigInt(Math.ceil(Duration.toMillis(duration) * NANOS_PER_MILLI)))
  )

/**
 * `Effect.timeoutOrElse`, with the deadline counted in awake time.
 *
 * Same race semantics: whichever of `self` and the deadline completes first
 * wins, and the loser is interrupted — so a timed-out child is still released
 * by its scope.
 */
export const timeoutAwakeOrElse = <A, E, R, A2, E2, R2>(
  self: Effect.Effect<A, E, R>,
  options: {
    readonly duration: Duration.Duration
    readonly orElse: () => Effect.Effect<A2, E2, R2>
  }
): Effect.Effect<A | A2, E | E2, R | R2> =>
  Effect.raceFirst(
    Effect.map(self, (value) => ({ timedOut: false as const, value })),
    Effect.as(sleepAwake(options.duration), { timedOut: true as const })
  ).pipe(
    Effect.flatMap((settled): Effect.Effect<A | A2, E2, R2> =>
      settled.timedOut ? options.orElse() : Effect.succeed(settled.value)
    )
  )
