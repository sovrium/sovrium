/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `POST /api/internal/tables/retention-due` — run one table retention sweep on
 * demand, and answer `{ deleted: { <table>: <rows deleted> } }`.
 *
 * The same sweep runs daily at 03:30 on its own (`register-table-retention.ts`);
 * this route exists so a test can run it deterministically. It is gated
 * exactly like its siblings (`webhook-outbox-routes.ts`): without a matching
 * `X-Internal-Scheduler-Token` — and always, when `INTERNAL_SCHEDULER_TOKEN` is
 * unset, which is the production posture — it answers 404 as if it did not
 * exist.
 */

import { purgeExpiredTableRows } from '@/infrastructure/database/table-retention'
import {
  internalSchedulerNotFound,
  isInternalSchedulerRequest,
} from '@/presentation/api/runtime/internal-scheduler-gate'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/** Sweep every table declaring a window; answers the rows deleted per table. */
async function handleRetentionDue(c: Context, app: App): Promise<Response> {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  const deleted = await purgeExpiredTableRows(app)
  return c.json({ deleted }, 200)
}

/**
 * Chain the table retention trigger route onto a Hono app. Registered without
 * a session requirement: the scheduler token IS the gate.
 */
export function chainTableRetentionRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp.post('/api/internal/tables/retention-due', (c) =>
    handleRetentionDue(c, resolveApp())
  ) as T
}
