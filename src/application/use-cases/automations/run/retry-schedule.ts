/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The retry policy of the automation run loop: the normalised retry config, the
 * `Schedule` it becomes, and the rule picking an action's own config over its
 * automation's.
 */

import { Duration, Effect, Schedule } from 'effect'

/** Normalised retry config: concrete `delayMs`; `strategy` `'fixed'` (default) or `'exponential'`. */
export interface ResolvedRetryConfig {
  readonly maxAttempts: number
  readonly delayMs: number
  readonly strategy: 'fixed' | 'exponential'
}

/**
 * Base delay used when a retry config sets `maxAttempts` but no `delayMs`.
 * Kept small so the E2E specs (which exercise real retries through a real
 * scheduler) stay fast — exponential growth from 50ms is 50/100/200/…,
 * well under the spec wait windows.
 */
const DEFAULT_RETRY_DELAY_MS = 50

/** Cap on any single inter-attempt sleep, so exponential growth cannot wedge a handler. */
const MAX_RETRY_DELAY_MS = 30_000

/**
 * The retry policy for one action, as an Effect `Schedule`.
 *
 * Emits one delay before each RETRY — none before the first attempt, and none
 * after the last failure — so a `maxAttempts: N` config yields `N - 1` delays
 * and exactly `N` invocations. `'exponential'` doubles from the base
 * (`base * 2^(n-1)`, matching `Schedule.exponential`'s 1-indexed `attempt`);
 * `'fixed'` holds the base constant. Every delay is capped at
 * {@link MAX_RETRY_DELAY_MS}, and a `delayMs` of 0 (the shape `toResolvedRetry`
 * produces when the config omits it) falls back to
 * {@link DEFAULT_RETRY_DELAY_MS}.
 *
 * The exact sequence is pinned in `retry-schedule.test.ts` — no E2E spec can
 * observe it, so that unit test is the only guard against silent drift.
 */
export const retrySchedule = (retry: ResolvedRetryConfig): Schedule.Schedule<Duration.Duration> => {
  const base = retry.delayMs > 0 ? retry.delayMs : DEFAULT_RETRY_DELAY_MS
  // `exponential` computes `base * factor^(attempt - 1)`, so a factor of 1 is
  // precisely the `'fixed'` strategy — one constructor covers both, and both
  // branches then share the `Duration` output type.
  const growth = Schedule.exponential(
    Duration.millis(base),
    retry.strategy === 'exponential' ? 2 : 1
  )
  return growth.pipe(
    Schedule.modifyDelay(({ duration }) =>
      Effect.succeed(Duration.min(duration, Duration.millis(MAX_RETRY_DELAY_MS)))
    ),
    // `maxAttempts` counts TOTAL attempts and the first one is not a retry, so
    // the schedule may recur at most `maxAttempts - 1` times.
    Schedule.upTo({ times: Math.max(0, retry.maxAttempts - 1) })
  )
}

/**
 * Coerce a raw `retry` object (from `automation.retry` or `action.retry`)
 * into the {@link ResolvedRetryConfig} shape, or undefined if the input is
 * not a usable retry config. `maxAttempts` is the only required field; an
 * absent `delayMs` resolves to 0.
 */
export const toResolvedRetry = (raw: unknown): ResolvedRetryConfig | undefined => {
  if (raw === null || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const maxAttempts = typeof r['maxAttempts'] === 'number' ? r['maxAttempts'] : undefined
  if (maxAttempts === undefined || !Number.isFinite(maxAttempts) || maxAttempts < 1) {
    return undefined
  }
  const delayMs =
    typeof r['delayMs'] === 'number' && Number.isFinite(r['delayMs']) ? r['delayMs'] : 0
  const strategy: 'fixed' | 'exponential' =
    r['strategy'] === 'exponential' ? 'exponential' : 'fixed'
  return { maxAttempts: Math.floor(maxAttempts), delayMs, strategy }
}

/**
 * Resolve the retry policy for one action: a per-action `retry` REPLACES the
 * automation-level one; falling back to the automation-level config when the
 * action does not declare its own. Returns undefined when neither is set.
 */
export const resolveRetryForAction = (
  rawAction: Readonly<Record<string, unknown>>,
  automationRetry: ResolvedRetryConfig | undefined
): ResolvedRetryConfig | undefined => {
  const actionRetry = toResolvedRetry(rawAction['retry'])
  return actionRetry ?? automationRetry
}
