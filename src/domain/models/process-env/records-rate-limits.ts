/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parsePositiveIntEnv } from './positive-int-env'

/**
 * The two budgets of the records API (`/api/tables/*`) an operator can set,
 * each counted per caller in the `RATE_LIMIT_WINDOW_SECONDS` window:
 *
 * - `RATE_LIMIT_WRITES` — the writes (POST, PATCH, PUT and DELETE) one caller
 *   may make, all four methods drawing on one budget. A batch request is one
 *   write however many records it carries.
 * - `RATE_LIMIT_READS` — the reads one signed-in person may make. Nobody
 *   reaches it by using the pages of an app; it slows, and makes visible, a
 *   session that copies a whole base.
 *
 * A value that is not a whole number above zero refuses the boot, as
 * `API_IP_RATE_LIMIT` does: read leniently, it would switch a limit off.
 */

/** The write budget's variable. */
export const RATE_LIMIT_WRITES_VAR = 'RATE_LIMIT_WRITES'

/** The signed-in read ceiling's variable. */
export const RATE_LIMIT_READS_VAR = 'RATE_LIMIT_READS'

/** Writes per caller per window. */
export const DEFAULT_RATE_LIMIT_WRITES = 120

/** Reads per signed-in person per window. */
export const DEFAULT_RATE_LIMIT_READS = 600

type Env = Readonly<Record<string, string | undefined>>

const parseBudget = (env: Env, name: string, fallback: number): number => {
  const raw = env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const value = parsePositiveIntEnv(raw)
  if (value === undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${name} must be a whole number of requests above zero; "${raw.trim()}" is not one.`
    )
  }
  return value
}

/**
 * Resolve both budgets for the boot gate. Unset, empty or whitespace-only is
 * the default.
 *
 * @throws Error naming the variable and the value when one is not a whole
 *   number of requests above zero.
 */
export const parseRecordsRateLimits = (
  env: Env = process.env
): { readonly writes: number; readonly reads: number } => ({
  writes: parseBudget(env, RATE_LIMIT_WRITES_VAR, DEFAULT_RATE_LIMIT_WRITES),
  reads: parseBudget(env, RATE_LIMIT_READS_VAR, DEFAULT_RATE_LIMIT_READS),
})

/** The write budget for a request already being served; never throws (the boot refused a bad value). */
export const resolveRateLimitWrites = (env: Env = process.env): number =>
  parsePositiveIntEnv(env[RATE_LIMIT_WRITES_VAR]) ?? DEFAULT_RATE_LIMIT_WRITES

/** The signed-in read ceiling for a request already being served; never throws. */
export const resolveRateLimitReads = (env: Env = process.env): number =>
  parsePositiveIntEnv(env[RATE_LIMIT_READS_VAR]) ?? DEFAULT_RATE_LIMIT_READS
