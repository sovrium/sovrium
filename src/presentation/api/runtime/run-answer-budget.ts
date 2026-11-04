/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How long a request that starts an automation run may hold its caller before
 * it answers that the run was accepted rather than finished.
 *
 * A run can wait for a concurrency slot, then take as long as its steps do.
 * Held past the listener's idle guard (`SOVRIUM_REQUEST_IDLE_TIMEOUT_S`) the
 * connection is cut and the caller reads a failure, though the run goes on and
 * completes; held past `API_TIMEOUT_MS` it is answered `504`. So the answer
 * comes two seconds before the shorter of the two, and an operator who widens
 * the guard widens this budget with it.
 */

import { parsePositiveIntEnv } from '@/domain/models/process-env/positive-int-env'
import { resolveRequestIdleTimeoutSeconds } from '@/domain/models/process-env/server-lifecycle'

/** The default `API_TIMEOUT_MS`, as the request guards apply it. */
const DEFAULT_API_TIMEOUT_MS = 30_000

/** How far ahead of the first cut the answer goes out. */
const ANSWER_MARGIN_MS = 2000

/** Never shorter than this, so a narrow guard still lets a quick run answer in full. */
const MIN_ANSWER_BUDGET_MS = 1000

/** The time budget, in milliseconds, under the environment's guards (8 s by default). */
export const runAnswerBudgetMs = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number => {
  const guardMs = resolveRequestIdleTimeoutSeconds(env) * 1000
  const apiTimeoutMs = parsePositiveIntEnv(env['API_TIMEOUT_MS']) ?? DEFAULT_API_TIMEOUT_MS
  return Math.max(MIN_ANSWER_BUDGET_MS, Math.min(guardMs, apiTimeoutMs) - ANSWER_MARGIN_MS)
}
