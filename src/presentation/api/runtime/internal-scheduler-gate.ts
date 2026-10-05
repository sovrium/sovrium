/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The gate every internal scheduler trigger route sits behind.
 *
 * A trigger route runs a job the scheduler normally runs on its own clock — an
 * erasure sweep, a failure roll-up — so a test can run it deterministically
 * instead of waiting for the clock. None of them is for the internet:
 *
 *   - `INTERNAL_SCHEDULER_TOKEN` unset (the production default) → every trigger
 *     route answers 404, as if it did not exist;
 *   - set → the caller must present it in `X-Internal-Scheduler-Token`, and a
 *     missing or wrong token answers 404 too.
 *
 * 404 rather than 401/403, so a probe cannot even confirm the route exists.
 */

import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { constantTimeEqual } from './constant-time-equal'
import type { Context } from 'hono'

/** Env var holding the internal shared secret. Set only by the E2E harness. */
const SCHEDULER_TOKEN_ENV = 'INTERNAL_SCHEDULER_TOKEN'

/** Header carrying the internal scheduler token. */
const SCHEDULER_TOKEN_HEADER = 'X-Internal-Scheduler-Token'

/** Whether this request carries the configured internal scheduler token. */
export function isInternalSchedulerRequest(c: Context): boolean {
  const expected = process.env[SCHEDULER_TOKEN_ENV]
  if (expected === undefined || expected.length === 0) return false
  const provided = c.req.header(SCHEDULER_TOKEN_HEADER)
  return provided !== undefined && constantTimeEqual(provided, expected)
}

/** The answer a trigger route gives a caller without the token. */
export const internalSchedulerNotFound = (c: Context): Response => notFound(c, 'Not Found')
