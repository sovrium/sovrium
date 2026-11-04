/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The engine clock on the development timeline: an Effect `Clock` whose "now"
 * is the pinned instant plus the real time elapsed since the server started
 * (`onDevTimeline`), so a program that reads `Clock` or `DateTime.now` under
 * {@link withDevTimelineClock} answers on the instant `SOVRIUM_DEV_CLOCK`
 * pinned, and time still moves forward while the server runs. Sleeping and
 * the monotonic clock stay real.
 *
 * Unpinned (and always in production), the program runs on the clock it was
 * given, unchanged.
 */

import { Clock, Effect } from 'effect'
import { readSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import { onDevTimeline } from './server-boot-instant'

/** `real`, with its wall-clock reads moved onto the development timeline. */
const devTimelineClockOver = (real: Clock.Clock): Clock.Clock => {
  const nowMs = (): number => onDevTimeline(new Date(real.currentTimeMillisUnsafe())).getTime()
  return {
    currentTimeMillisUnsafe: nowMs,
    currentTimeMillis: Effect.sync(nowMs),
    currentTimeNanosUnsafe: () => BigInt(nowMs()) * 1_000_000n,
    currentTimeNanos: Effect.sync(() => BigInt(nowMs()) * 1_000_000n),
    monotonicTimeNanosUnsafe: () => real.monotonicTimeNanosUnsafe(),
    monotonicTimeNanos: real.monotonicTimeNanos,
    sleep: (duration) => real.sleep(duration),
  }
}

/** Run `effect` on the development timeline when a clock is pinned, as it is otherwise. */
export const withDevTimelineClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  readSovriumDevClock(process.env) === undefined
    ? effect
    : Clock.clockWith((real) =>
        effect.pipe(Effect.provideService(Clock.Clock, devTimelineClockOver(real)))
      )
