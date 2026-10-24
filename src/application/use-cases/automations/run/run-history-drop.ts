/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import {
  dropsRunHistory,
  dropsRunRow,
} from '@/domain/models/app/automations/trigger/trigger-history-service'
import { logError } from '@/infrastructure/logging/logger'
import type { Trigger } from '@/domain/models/app/automations/trigger'

/**
 * Drop what a run of a `history: 'minimal'` or `'none'` trigger keeps no longer
 * once `status` says it ended — the steps an earlier paused segment wrote
 * included, and, called by the approval road, the paused parent a run resumed
 * from: its whole row when a `none` run succeeded, its trigger data and step
 * rows otherwise. Logged and swallowed: the run itself is finalised either way.
 */
export const dropEndedRunHistory = (
  trigger: Trigger | undefined,
  status: string,
  runId: string
): Effect.Effect<void, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const dropsRow = dropsRunRow(trigger, status)
    if (!dropsRow && !dropsRunHistory(trigger, status)) return
    const repo = yield* AutomationRunRepository
    const dropped = yield* Effect.result(
      dropsRow ? repo.deleteRun(runId) : repo.clearRunHistory(runId)
    )
    if (dropped._tag === 'Failure') {
      logError('[automation] failed to drop the history of an ended run', dropped.failure)
    }
  }).pipe(Effect.withSpan('automations.drop-ended-run-history'))
