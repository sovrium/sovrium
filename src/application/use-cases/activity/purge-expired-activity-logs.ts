/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { RetentionSweeps } from '@/application/ports/services/retention-sweeps'

/**
 * Run the activity-log retention sweep once, on demand — the same sweep the
 * daily cron runs. Answers how many rows it deleted.
 */
export const purgeExpiredActivityLogs = Effect.fn('activity.purge-expired-logs')(function* () {
  const sweeps = yield* RetentionSweeps
  return yield* sweeps.purgeExpiredActivityLogs
})
