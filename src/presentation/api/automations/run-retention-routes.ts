/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `POST /api/internal/automations/prune-runs` — run one run-history sweep on
 * demand, and answer `{ deleted: <runs deleted> }`.
 *
 * The same sweep runs daily at 03:45 on its own
 * (`register-automation-run-retention.ts`), over the window
 * `SOVRIUM_AUTOMATION_RUN_RETENTION_DAYS` sets, ninety days when unset. Gated
 * like every internal trigger route: 404 without a matching
 * `X-Internal-Scheduler-Token`, and always when `INTERNAL_SCHEDULER_TOKEN` is
 * unset.
 */

import { Effect } from 'effect'
import { pruneRunHistory } from '@/application/use-cases/automations/prune-run-history'
import {
  internalSchedulerNotFound,
  isInternalSchedulerRequest,
} from '@/presentation/api/runtime/internal-scheduler-gate'
import { respondWith, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import type { Context, Hono } from 'hono'

/** Delete the ended runs past the window; answers how many went. */
async function handlePruneRuns(c: Context): Promise<Response> {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  return runHandlerEffect(
    c,
    respondWith(c, pruneRunHistory().pipe(Effect.map((deleted) => ({ deleted }))))
  )
}

/**
 * Chain the run-history trigger route onto a Hono app. Registered without a
 * session requirement: the scheduler token IS the gate.
 */
export function chainRunRetentionRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.post('/api/internal/automations/prune-runs', (c) => handlePruneRuns(c)) as T
}
