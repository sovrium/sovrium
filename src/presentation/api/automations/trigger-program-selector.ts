/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Effect } from 'effect'
import {
  type ExecuteAutomationRunRequirements,
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import { runCronAutomationOnDemand } from '@/application/use-cases/automations/run-cron-automation'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import { hasTriggerOfType } from '@/domain/models/app/automations/trigger-entries-service'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'

/**
 * Select the run program for the `POST /api/automations/:name/trigger`
 * endpoint.
 *
 * A `cron`-triggered automation is invocable ON DEMAND ("run now") here by an
 * authorized operator — it runs the action chain once immediately WITHOUT
 * touching the background schedule, reusing the existing cron runner
 * (`runCronAutomationOnDemand`) and mirroring the manual trigger's auth gate
 * (default 'admin'; anonymous → 404). An automation with a manual trigger —
 * among others or alone — routes to the manual path, under that trigger's role.
 */
export function selectTriggerProgram(input: {
  readonly name: string
  readonly app: App
  readonly userRole: string | undefined
  readonly body: unknown
  readonly userId: string | undefined
}): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  ExecuteAutomationRunRequirements | AutomationPauseRepository
> {
  const { name, app, userRole, body, userId } = input
  const shared = {
    name,
    app,
    processEnv: process.env,
    userRole,
    ...(userId !== undefined ? { userId } : {}),
  }
  // A manual entry answers this endpoint; a "run now" of the schedule only
  // when the automation has a cron entry and no manual one.
  const automation = app.automations?.find((a) => a.name === name)
  const runsNow =
    automation !== undefined &&
    !hasTriggerOfType(automation, 'manual') &&
    hasTriggerOfType(automation, 'cron')
  return runsNow
    ? runCronAutomationOnDemand({
        ...shared,
        triggerData: { body, type: 'cron', invokedOnDemand: true },
      })
    : runManualAutomation({ ...shared, triggerData: { body }, byName: true })
}
