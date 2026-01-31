/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation Retry Utilities
 *
 * Reusable retry logic using Effect.Schedule for robust error handling
 * in GitHub API operations and other fallible tasks.
 */

import { Effect, Schedule, Duration } from 'effect'

/**
 * Retry configuration options
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  readonly maxAttempts: number
  /** Initial delay between retries */
  readonly initialDelay: Duration.DurationInput
  /** Maximum delay between retries (for exponential backoff) */
  readonly maxDelay?: Duration.DurationInput
  /** Whether to use exponential backoff */
  readonly exponential?: boolean
  /** Jitter factor (0-1) to add randomness to delays */
  readonly jitter?: number
}

/**
 * Default retry configuration for GitHub API operations
 *
 * - 3 attempts max
 * - 1 second initial delay
 * - Exponential backoff with 30s cap
 * - 10% jitter
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: '1 seconds',
  maxDelay: '30 seconds',
  exponential: true,
  jitter: 0.1,
}

/**
 * Quick retry configuration for fast operations
 *
 * - 2 attempts max
 * - 500ms delay
 * - No exponential backoff
 */
export const QUICK_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  initialDelay: '500 millis',
  exponential: false,
}

/**
 * Aggressive retry configuration for critical operations
 *
 * - 5 attempts max
 * - 2 second initial delay
 * - Exponential backoff with 60s cap
 * - 20% jitter
 */
export const AGGRESSIVE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelay: '2 seconds',
  maxDelay: '60 seconds',
  exponential: true,
  jitter: 0.2,
}

/**
 * Create a retry schedule from configuration
 *
 * @param config - Retry configuration
 * @returns Effect Schedule for use with Effect.retry
 *
 * @example
 * ```typescript
 * const schedule = createRetrySchedule(DEFAULT_RETRY_CONFIG)
 * const result = await Effect.runPromise(
 *   fetchData.pipe(Effect.retry(schedule))
 * )
 * ```
 */
export function createRetrySchedule<E>(config: RetryConfig): Schedule.Schedule<number, E, never> {
  // Base delay schedule
  let delaySchedule: Schedule.Schedule<Duration.Duration, unknown, never> = config.exponential
    ? Schedule.exponential(config.initialDelay, 2)
    : Schedule.spaced(config.initialDelay).pipe(
        Schedule.map(() => Duration.decode(config.initialDelay))
      )

  // Apply jitter if configured
  if (config.jitter && config.jitter > 0) {
    delaySchedule = delaySchedule.pipe(Schedule.jittered)
  }

  // Limit to max attempts and compose with delay
  const limitSchedule = Schedule.recurs(config.maxAttempts - 1)

  return Schedule.intersect(limitSchedule, delaySchedule).pipe(Schedule.map(([count]) => count))
}

/**
 * Wrap an effect with default retry behavior
 *
 * @param effect - Effect to retry on failure
 * @param config - Optional retry configuration (defaults to DEFAULT_RETRY_CONFIG)
 * @returns Effect with retry behavior applied
 *
 * @example
 * ```typescript
 * const resilientFetch = withRetry(
 *   fetchFromAPI(url),
 *   { maxAttempts: 5, initialDelay: '2 seconds', exponential: true }
 * )
 * ```
 */
export function withRetry<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Effect.Effect<A, E, R> {
  const schedule = createRetrySchedule<E>(config)
  return effect.pipe(Effect.retry(schedule))
}

/**
 * Retry with logging on each attempt
 *
 * @param effect - Effect to retry
 * @param label - Label for logging
 * @param config - Retry configuration
 * @returns Effect with retry and logging
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   withRetryLogging(
 *     fetchUser(id),
 *     'fetchUser',
 *     AGGRESSIVE_RETRY_CONFIG
 *   )
 * )
 * ```
 */
export function withRetryLogging<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  label: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Effect.Effect<A, E, R> {
  let attempt = 0

  const loggedEffect = effect.pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        attempt = 0 // Reset on success
      })
    ),
    Effect.tapError((error) =>
      Effect.sync(() => {
        attempt++
        console.log(`[${label}] Attempt ${attempt}/${config.maxAttempts} failed:`, error)
        if (attempt < config.maxAttempts) {
          console.log(`[${label}] Retrying...`)
        }
      })
    )
  )

  return withRetry(loggedEffect, config)
}

/**
 * Retry only on specific error types
 *
 * @param effect - Effect to retry
 * @param shouldRetry - Predicate to determine if error should trigger retry
 * @param config - Retry configuration
 * @returns Effect with conditional retry behavior
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   retryOnCondition(
 *     apiCall,
 *     (error) => error._tag === 'RateLimitError',
 *     AGGRESSIVE_RETRY_CONFIG
 *   )
 * )
 * ```
 */
export function retryOnCondition<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  shouldRetry: (error: E) => boolean,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Effect.Effect<A, E, R> {
  const schedule = createRetrySchedule<E>(config).pipe(Schedule.whileInput(shouldRetry))

  return effect.pipe(Effect.retry(schedule))
}

/**
 * Retry with exponential backoff, commonly used pattern
 *
 * @param effect - Effect to retry
 * @param maxAttempts - Maximum number of attempts
 * @returns Effect with exponential backoff retry
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   retryWithExponentialBackoff(fetchData, 3)
 * )
 * ```
 */
export function retryWithExponentialBackoff<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  maxAttempts: number = 3
): Effect.Effect<A, E, R> {
  return withRetry(effect, {
    maxAttempts,
    initialDelay: '1 seconds',
    maxDelay: '30 seconds',
    exponential: true,
    jitter: 0.1,
  })
}
