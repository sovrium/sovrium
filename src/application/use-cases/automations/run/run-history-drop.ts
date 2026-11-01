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
import { triggerEntryName } from '@/domain/models/app/automations/trigger-list-validation'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
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

/**
 * {@link dropEndedRunHistory} for a closer that only knows the row: a sweep, a
 * cancel, a wait that cannot resume. The level is read off the entry the run
 * recorded, by its exact name. Once that entry cannot be found (the automation
 * or the trigger left the config, or the row names none) the level the run
 * started under is unknown, so the row is kept alone, whatever the level was.
 *
 * Every status a closer writes is unsuccessful, so a `none` run keeps its row.
 */
export const dropClosedRunHistory = (input: {
  readonly app: App
  readonly automationName: string
  readonly triggerName: string | null | undefined
  readonly status: string
  readonly runId: string
}): Effect.Effect<void, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const { app, automationName, triggerName, status, runId } = input
    const trigger = app.automations
      ?.find((automation) => automation.name === automationName)
      ?.triggers.find((entry) => triggerEntryName(entry) === triggerName)
    if (trigger !== undefined) return yield* dropEndedRunHistory(trigger, status, runId)
    const repo = yield* AutomationRunRepository
    const cleared = yield* Effect.result(repo.clearRunHistory(runId))
    if (cleared._tag === 'Failure') {
      logError('[automation] failed to drop the history of a closed run', cleared.failure)
    }
  }).pipe(Effect.withSpan('automations.drop-closed-run-history'))
