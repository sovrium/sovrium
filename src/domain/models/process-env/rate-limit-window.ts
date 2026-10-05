/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parsePositiveIntEnv } from './positive-int-env'

/**
 * `RATE_LIMIT_WINDOW_SECONDS` — the length of the sliding window every
 * per-address rate limit counts in: sign-in, sign-up and password reset,
 * records, activity, and the per-address API ceiling.
 *
 * ─── WHY A BAD VALUE THROWS ────────────────────────────────────────────────
 *
 * Read leniently, `abc` gave every limit a window that is not a number and
 * `0` a window of no length — both switch every limit off without a word.
 * Refusing the boot, naming the variable and the value, moves that discovery
 * to startup, exactly as `API_IP_RATE_LIMIT` does.
 */

/** The variable's name. */
export const RATE_LIMIT_WINDOW_SECONDS_VAR = 'RATE_LIMIT_WINDOW_SECONDS'

/** One minute. */
export const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60

/**
 * Resolve `RATE_LIMIT_WINDOW_SECONDS` for the boot gate. Unset, empty or
 * whitespace-only is {@link DEFAULT_RATE_LIMIT_WINDOW_SECONDS}.
 *
 * @throws Error naming the variable and the value when it is not a whole number
 *   of seconds above zero.
 */
export const parseRateLimitWindowSeconds = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number => {
  const raw = env[RATE_LIMIT_WINDOW_SECONDS_VAR]
  if (raw === undefined || raw.trim() === '') return DEFAULT_RATE_LIMIT_WINDOW_SECONDS
  const value = parsePositiveIntEnv(raw)
  if (value === undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${RATE_LIMIT_WINDOW_SECONDS_VAR} must be a whole number of seconds above zero; "${raw.trim()}" is not one.`
    )
  }
  return value
}

/**
 * The window for a request that is already being served: the variable's
 * value, or {@link DEFAULT_RATE_LIMIT_WINDOW_SECONDS} when it is unset or
 * invalid. Never throws and never answers `NaN` or zero — the boot already
 * refused an invalid value.
 */
export const resolveRateLimitWindowSeconds = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number =>
  parsePositiveIntEnv(env[RATE_LIMIT_WINDOW_SECONDS_VAR]) ?? DEFAULT_RATE_LIMIT_WINDOW_SECONDS
