/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { defaultActionHandlers } from './action-handlers'
import { toleratedInRows } from './run/resume-plan'
import { dropEndedMinimalHistory } from './run/run-persistence'
import { executeAutomationRun, resolveAutomationId } from './run-automation'
import type {
  ApplyApprovalOutcomeInput,
  ResolveApprovalError,
  ResolveApprovalResult,
  ResolveRequirements,
} from './resolve-automation-approval'

/**
 * Build the set of action names to skip on resume: every action at index
 * ≤ the approval's `stepIndex` (the approval itself + everything before it).
 * Those already ran in the original (now-paused) run, so re-running them
 * would duplicate their side effects.
 */
const collectActionsUpToIndex = (
  actions: readonly { readonly name?: unknown }[],
  stepIndex: number
): ReadonlySet<string> =>
  new Set(
    actions
      .slice(0, stepIndex + 1)
      .map((a) => String(a.name ?? ''))
      .filter((name) => name !== '')
  )

/** Re-run a paused run's tail past its resolved approval step, seeding that step's output. */
export const resumePastApproval = (
  input: ApplyApprovalOutcomeInput,
  approvalStepName: string | undefined,
  output: Readonly<Record<string, unknown>>
): Effect.Effect<ResolveApprovalResult, ResolveApprovalError, ResolveRequirements> =>
  Effect.gen(function* () {
    const { runId, approvalId, target, decision, app, processEnv } = input
    const runRepo = yield* AutomationRunRepository
    // A failure of `resolveAutomationId` is a registry write
    // (`AutomationRegistrySeedError`), never a 404.
    const { name } = target.automation
    const automationId = yield* resolveAutomationId(name, target.automation)
    const skipActionNames = collectActionsUpToIndex(
      target.automation.actions as readonly { readonly name?: unknown }[],
      target.stepIndex
    )
    const stored = yield* runRepo.findStepsByRunId(runId)
    const before = stored.filter((row) => row.stepIndex < target.stepIndex)
    const result = yield* executeAutomationRun({
      name,
      automation: target.automation,
      trigger: target.trigger,
      automationId,
      app,
      processEnv,
      triggerData: target.triggerData,
      handlers: input.handlers ?? defaultActionHandlers,
      // The persisted `triggerData`, never a session: a hand-started run resumes as
      // its caller, any other system-side. A failure tolerated before the pause counts.
      ...target.startedBy,
      priorTolerated: toleratedInRows(before),
      // A hand-started run's starter may have been banned while it waited.
      checkStarterStanding: true,
      skipActionNames,
      // A later step reads the outcome as `{{<approval step>.result.decision}}`,
      // and who decided as `{{<approval step>.result.resolvedBy}}`.
      ...(approvalStepName === undefined ? {} : { seedOutputs: { [approvalStepName]: output } }),
      ...(target.relay === undefined ? {} : { relay: target.relay }),
    })
    yield* dropEndedMinimalHistory(target.trigger, result.status, runId) // the paused parent
    return { decision, runId, approvalId, result } as const
  }).pipe(Effect.withSpan('automations.resume-past-approval'))
