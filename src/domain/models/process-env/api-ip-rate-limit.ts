/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parsePositiveIntEnv } from './positive-int-env'

/**
 * `API_IP_RATE_LIMIT` — how many API requests one client address may send per
 * `RATE_LIMIT_WINDOW_SECONDS` window before the per-address ceiling refuses it.
 *
 * The ceiling runs ahead of every session lookup, so it cannot tell two people
 * behind one address apart. That is why it is an operator setting rather than a
 * fixed cap: a team whose users all arrive through one office address raises
 * it, and nobody else needs to touch it.
 *
 * ─── WHY A BAD VALUE THROWS ────────────────────────────────────────────────
 *
 * `API_IP_RATE_LIMIT=5000/min` read leniently would fall back to the default
 * the operator meant to change, and they would find out only when their users
 * were refused. Refusing the boot, naming the variable and the value, moves
 * that discovery to startup.
 */

/** The variable's name. */
export const API_IP_RATE_LIMIT_VAR = 'API_IP_RATE_LIMIT'

/**
 * Twenty requests a second, sustained, from one address: twelve times the
 * highest per-route budget (records, 100), so every existing limit binds first.
 */
export const DEFAULT_API_IP_RATE_LIMIT = 1200

/**
 * Resolve `API_IP_RATE_LIMIT` for the boot gate. Unset, empty or
 * whitespace-only is {@link DEFAULT_API_IP_RATE_LIMIT}.
 *
 * @throws Error naming the variable and the value when it is not a whole number
 *   above zero.
 */
export const parseApiIpRateLimit = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number => {
  const raw = env[API_IP_RATE_LIMIT_VAR]
  if (raw === undefined || raw.trim() === '') return DEFAULT_API_IP_RATE_LIMIT
  const value = parsePositiveIntEnv(raw)
  if (value === undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${API_IP_RATE_LIMIT_VAR} must be a whole number of requests above zero; "${raw.trim()}" is not one.`
    )
  }
  return value
}

/**
 * The ceiling for a request that is already being served: the variable's value,
 * or {@link DEFAULT_API_IP_RATE_LIMIT} when it is unset or invalid. Never throws
 * — the boot already refused an invalid value.
 */
export const resolveApiIpRateLimit = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number => parsePositiveIntEnv(env[API_IP_RATE_LIMIT_VAR]) ?? DEFAULT_API_IP_RATE_LIMIT
