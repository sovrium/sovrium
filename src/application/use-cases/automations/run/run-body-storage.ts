/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import {
  keepsMinimalHistory,
  triggerDataUnderWay,
} from '@/domain/models/app/automations/trigger/trigger-history-service'
import { logError } from '@/infrastructure/logging/logger'
import type { Trigger } from '@/domain/models/app/automations/trigger'

/**
 * A run of a `history: 'minimal'` or `'none'` trigger stores no request body
 * while it is under way: its queued row is written without one, and the body
 * lands on the row only when the run pauses, since a resume after a restart
 * reads it from there (`run-persistence.ts`). Once the run is under way again
 * it runs on the body in memory, so this takes the body off the row.
 *
 * A `full` trigger's row keeps it all along: nothing is written. Logged and
 * swallowed: the run goes on whether or not the write landed.
 */
export const clearBodyUnderWay = (
  trigger: Trigger | undefined,
  runId: string,
  triggerData: unknown
): Effect.Effect<void, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    if (!keepsMinimalHistory(trigger)) return
    const repo = yield* AutomationRunRepository
    const cleared = yield* Effect.result(
      repo.replaceTriggerData(runId, triggerDataUnderWay(trigger, triggerData))
    )
    if (cleared._tag === 'Failure') {
      logError('[automation] failed to clear the body of a resumed run', cleared.failure)
    }
  }).pipe(Effect.withSpan('automations.clear-body-under-way'))
