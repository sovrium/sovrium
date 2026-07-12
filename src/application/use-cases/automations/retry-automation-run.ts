/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { replayAutomationRun, type ReplayAutomationRunError } from './replay-automation-run'
import type { ExecuteAutomationRunRequirements, RunAutomationResult } from './run-automation'
import type { App } from '@/domain/models/app'

export interface RetryAutomationRunOptions {
  readonly runId: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly userId?: string
}

export const retryAutomationRun = (
  options: RetryAutomationRunOptions
): Effect.Effect<
  RunAutomationResult,
  ReplayAutomationRunError,
  AutomationRunRepository | ExecuteAutomationRunRequirements
> =>
  Effect.gen(function* () {
    const { runId, app, processEnv, userId } = options

    const repo = yield* AutomationRunRepository
    const run = yield* repo
      .findById(runId)
      .pipe(Effect.mapError(() => ({ _tag: 'AutomationRunNotFound' as const, runId })))
    if (run === undefined) {
      return yield* Effect.fail({ _tag: 'AutomationRunNotFound' as const, runId })
    }

    return yield* replayAutomationRun({
      name: run.automationName,
      runId,
      app,
      processEnv,
      ...(userId !== undefined ? { userId } : {}),
    })
  })
