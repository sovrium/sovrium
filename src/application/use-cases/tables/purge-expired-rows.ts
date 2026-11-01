/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { RetentionSweeps } from '@/application/ports/services/retention-sweeps'
import type { App } from '@/domain/models/app'

/**
 * Run the table retention sweep once, on demand, over every table that
 * declares a window — the same sweep the daily 03:30 cron runs. Answers the
 * rows deleted per table.
 */
export const purgeExpiredRows = Effect.fn('tables.purge-expired-rows')(function* (app: App) {
  const sweeps = yield* RetentionSweeps
  return yield* sweeps.purgeExpiredTableRows(app)
})
