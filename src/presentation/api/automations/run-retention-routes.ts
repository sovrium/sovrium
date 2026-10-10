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
 * The same sweep runs daily at 03:45 on its own when
 * `SOVRIUM_AUTOMATION_RUN_RETENTION_DAYS` is set
 * (`register-automation-run-retention.ts`); unset, both delete nothing. Gated
 * like every internal trigger route: 404 without a matching
 * `X-Internal-Scheduler-Token`, and always when `INTERNAL_SCHEDULER_TOKEN` is
 * unset.
 */

import { pruneExpiredAutomationRuns } from '@/infrastructure/database/automation-run-retention'
import {
  internalSchedulerNotFound,
  isInternalSchedulerRequest,
} from '@/presentation/api/runtime/internal-scheduler-gate'
import type { Context, Hono } from 'hono'

/** Delete the ended runs past the window; answers how many went. */
async function handlePruneRuns(c: Context): Promise<Response> {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  const deleted = await pruneExpiredAutomationRuns()
  return c.json({ deleted }, 200)
}

/**
 * Chain the run-history trigger route onto a Hono app. Registered without a
 * session requirement: the scheduler token IS the gate.
 */
export function chainRunRetentionRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.post('/api/internal/automations/prune-runs', (c) => handlePruneRuns(c)) as T
}
