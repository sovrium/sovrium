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
import type { App } from '@/domain/models/app'

export function selectTriggerProgram(input: {
  readonly name: string
  readonly app: App
  readonly userRole: string | undefined
  readonly body: unknown
  readonly userId: string | undefined
}): Effect.Effect<RunAutomationResult, RunAutomationError, ExecuteAutomationRunRequirements> {
  const { name, app, userRole, body, userId } = input
  const shared = {
    name,
    app,
    processEnv: process.env,
    userRole,
    ...(userId !== undefined ? { userId } : {}),
  }
  return app.automations?.find((a) => a.name === name)?.trigger.type === 'cron'
    ? runCronAutomationOnDemand({
        ...shared,
        triggerData: { body, type: 'cron', invokedOnDemand: true },
      })
    : runManualAutomation({ ...shared, triggerData: { body } })
}
