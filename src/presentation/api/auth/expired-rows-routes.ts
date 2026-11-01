/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `POST /api/internal/auth/prune-expired` — run one sweep of the expired
 * device codes and verification rows on demand, and answer
 * `{ deviceCodes, verifications }`, the rows deleted from each table.
 *
 * The same sweep runs daily on its own (`register-auth-expired-rows-sweep.ts`).
 * Gated like every internal trigger route: 404 without a matching
 * `X-Internal-Scheduler-Token`, and always when `INTERNAL_SCHEDULER_TOKEN` is
 * unset.
 */

import { pruneExpiredAuthRows } from '@/application/use-cases/auth/prune-expired-auth-rows'
import {
  internalSchedulerNotFound,
  isInternalSchedulerRequest,
} from '@/presentation/api/runtime/internal-scheduler-gate'
import { respondWith, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import type { Context, Hono } from 'hono'

/** Delete the expired sign-in rows; answers how many went from each table. */
async function handlePruneExpired(c: Context): Promise<Response> {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  return runHandlerEffect(c, respondWith(c, pruneExpiredAuthRows()))
}

/**
 * Chain the expired sign-in rows trigger route onto a Hono app. Registered
 * without a session requirement: the scheduler token IS the gate.
 */
export function chainExpiredAuthRowsRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.post('/api/internal/auth/prune-expired', (c) => handlePruneExpired(c)) as T
}
