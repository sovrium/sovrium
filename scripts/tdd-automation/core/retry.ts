/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Schedule, Duration } from 'effect'

export interface RetryConfig {
  readonly maxAttempts: number
  readonly initialDelay: Duration.DurationInput
  readonly maxDelay?: Duration.DurationInput
  readonly exponential?: boolean
  readonly jitter?: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: '1 seconds',
  maxDelay: '30 seconds',
  exponential: true,
  jitter: 0.1,
}

function createRetrySchedule<E>(config: RetryConfig): Schedule.Schedule<number, E, never> {
  let delaySchedule: Schedule.Schedule<Duration.Duration, unknown, never> = config.exponential
    ? Schedule.exponential(config.initialDelay, 2)
    : Schedule.spaced(config.initialDelay).pipe(
        Schedule.map(() => Duration.decode(config.initialDelay))
      )

  if (config.jitter && config.jitter > 0) {
    delaySchedule = delaySchedule.pipe(Schedule.jittered)
  }

  const limitSchedule = Schedule.recurs(config.maxAttempts - 1)

  return Schedule.intersect(limitSchedule, delaySchedule).pipe(Schedule.map(([count]) => count))
}

export function withRetry<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Effect.Effect<A, E, R> {
  const schedule = createRetrySchedule<E>(config)
  return effect.pipe(Effect.retry(schedule))
}
