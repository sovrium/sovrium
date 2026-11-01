/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { RetentionSweeps } from '@/application/ports/services/retention-sweeps'

/**
 * Run the automation run-history sweep once, on demand: the same sweep the
 * daily 03:45 cron runs when `SOVRIUM_AUTOMATION_RUN_RETENTION_DAYS` is set.
 * Answers how many runs it deleted.
 */
export const pruneRunHistory = Effect.fn('automations.prune-run-history')(function* () {
  const sweeps = yield* RetentionSweeps
  return yield* sweeps.pruneAutomationRuns
})
