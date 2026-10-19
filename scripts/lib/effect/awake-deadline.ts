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

/**
 * Sleep until `budgetNanos` of monotonic (awake) time has passed since `start`.
 *
 * When the budget runs out, `rearm` (if given) is asked for the budget that
 * holds NOW; a strictly larger one is slept out in turn, anything else ends the
 * sleep. Yields the budget that finally expired, so a timeout can name it.
 */
const sleepUntil = (
  start: bigint,
  budgetNanos: bigint,
  rearm: (() => bigint) | undefined
): Effect.Effect<bigint> =>
  Effect.flatMap(Clock.monotonicTimeNanos, (now) => {
    const remaining = budgetNanos - (now - start)
    if (remaining > BigInt(0)) {
      return Effect.flatMap(Effect.sleep(Duration.nanos(remaining)), () =>
        sleepUntil(start, budgetNanos, rearm)
      )
    }
    const next = rearm?.()
    return next !== undefined && next > budgetNanos
      ? sleepUntil(start, next, rearm)
      : Effect.succeed(budgetNanos)
  })

const toNanos = (duration: Duration.Duration): bigint =>
  BigInt(Math.ceil(Duration.toMillis(duration) * NANOS_PER_MILLI))

/**
 * Complete once `duration` of AWAKE time has elapsed — measured on the same
 * monotonic clock `Effect.timed` uses, so a deadline and the duration printed
 * beside it can never disagree.
 *
 * With `rearm`, the deadline is re-read each time it expires and may only GROW
 * (see {@link timeoutAwakeOrElse}). Yields the deadline that finally expired.
 */
export const sleepAwake = (
  duration: Duration.Duration,
  rearm?: () => Duration.Duration
): Effect.Effect<Duration.Duration> =>
  Effect.flatMap(Clock.monotonicTimeNanos, (start) =>
    Effect.map(
      sleepUntil(
        start,
        toNanos(duration),
        rearm === undefined ? undefined : () => toNanos(rearm())
      ),
      (expired) => Duration.millis(Number(expired) / NANOS_PER_MILLI)
    )
  )

/**
 * `Effect.timeoutOrElse`, with the deadline counted in awake time.
 *
 * Same race semantics: whichever of `self` and the deadline completes first
 * wins, and the loser is interrupted — so a timed-out child is still released
 * by its scope.
 *
 * `rearm` is the deadline's second reading. When `duration` expires it is
 * called once, and a LONGER deadline replaces the expired one (and is re-read
 * again when it, in turn, expires); an equal or shorter one lets the deadline
 * fire. It exists for budgets that stretch with machine load: the one-minute
 * load average is a damped mean that trails a contention spike by tens of
 * seconds, so a budget computed only when the step STARTS under-reads a
 * machine that filled up just after — which is exactly what happens on CI,
 * where every job of a run starts at once.
 * A deadline can therefore never move EARLIER, and `rearm` must be bounded (a
 * capped load factor is) or a hang would never end. `orElse` receives the
 * deadline that finally expired.
 */
export const timeoutAwakeOrElse = <A, E, R, A2, E2, R2>(
  self: Effect.Effect<A, E, R>,
  options: {
    readonly duration: Duration.Duration
    readonly rearm?: () => Duration.Duration
    readonly orElse: (expired: Duration.Duration) => Effect.Effect<A2, E2, R2>
  }
): Effect.Effect<A | A2, E | E2, R | R2> =>
  Effect.raceFirst(
    Effect.map(self, (value) => ({ timedOut: false as const, value })),
    Effect.map(sleepAwake(options.duration, options.rearm), (expired) => ({
      timedOut: true as const,
      expired,
    }))
  ).pipe(
    Effect.flatMap((settled): Effect.Effect<A | A2, E2, R2> =>
      settled.timedOut ? options.orElse(settled.expired) : Effect.succeed(settled.value)
    )
  )
