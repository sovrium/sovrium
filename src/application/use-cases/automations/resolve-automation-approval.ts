/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve a paused automation-step approval.
 *
 * A `waiting-approval` run is resumed (approve) or terminated (reject) via the
 * run-scoped endpoint
 * `POST /api/automations/runs/:runId/approvals/:approvalId/{approve,reject}`.
 *
 * RESUME mechanism (reuses the battle-tested replay skip machinery):
 *   - Load the pending approval row → verify it links to `runId` and is
 *     still `pending` (a second resolution is a no-op).
 *   - Load the paused run → resolve its automation definition + persisted
 *     `triggerData`.
 *   - APPROVE: mark the row `approved`, then re-run the automation skipping
 *     every action at index ≤ the approval's `stepIndex` (the approval action
 *     itself and everything before it already ran). The skipped actions are
 *     recorded as `'skipped'` (side-effects fire ONCE), and only the
 *     downstream actions execute — resuming the gated flow.
 *   - REJECT: mark the row `rejected` and finalise the paused run as
 *     terminal WITHOUT re-running; the downstream actions never execute.
 *
 * Re-running the tail with `skipActionNames` is observationally identical to
 * resuming the same run (the downstream side-effect appears) and reuses the
 * existing engine path rather than threading a half-finished accumulator
 * through a second invocation.
 */

import { Effect } from 'effect'
import { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import {
  executeAutomationRun,
  resolveAutomationId,
  type ExecuteAutomationRunRequirements,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { App } from '@/domain/models/app'

/**
 * Error tags surfaced by the approval-resolution flow. Mapped to HTTP
 * responses by the route handler.
 */
export type ResolveApprovalError =
  | { readonly _tag: 'ApprovalNotFound'; readonly approvalId: string }
  | { readonly _tag: 'ApprovalRunMismatch'; readonly approvalId: string; readonly runId: string }
  | {
      readonly _tag: 'ApprovalAlreadyResolved'
      readonly approvalId: string
      readonly status: string
    }
  | { readonly _tag: 'AutomationRunNotFound'; readonly runId: string }
  | { readonly _tag: 'AutomationNotFound'; readonly name: string }

/**
 * Result of resolving an approval. `decision` echoes the action taken;
 * `result` carries the resumed run on approve (absent on reject — the run
 * was terminated, not resumed).
 */
export interface ResolveApprovalResult {
  readonly decision: 'approved' | 'rejected'
  readonly runId: string
  readonly approvalId: string
  readonly result?: RunAutomationResult
}

export interface ResolveApprovalOptions {
  readonly runId: string
  readonly approvalId: string
  readonly decision: 'approve' | 'reject'
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
}

type ResolveRequirements =
  AutomationApprovalRepository | AutomationRunRepository | ExecuteAutomationRunRequirements

/**
 * Coerce the persisted `triggerData` JSON column into a `TriggerData` shape.
 * Null / non-object payloads degrade to an empty object (the resume still
 * runs, with no trigger context).
 */
const coerceTriggerData = (raw: unknown): TriggerData => {
  if (raw === null || raw === undefined || typeof raw !== 'object') return {}
  return raw as TriggerData
}

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

/**
 * Load the pending approval row + its paused run + the resolved automation,
 * validating the link to `runId` and that the row is still pending. Shared by
 * the approve and reject paths.
 */
const loadResolutionTarget = (input: {
  readonly runId: string
  readonly approvalId: string
  readonly app: App
}): Effect.Effect<
  {
    readonly stepIndex: number
    readonly automation: NonNullable<App['automations']>[number]
    readonly triggerData: TriggerData
  },
  ResolveApprovalError,
  AutomationApprovalRepository | AutomationRunRepository
> =>
  Effect.gen(function* () {
    const { runId, approvalId, app } = input
    const approvalRepo = yield* AutomationApprovalRepository
    const approval = yield* approvalRepo
      .findById(approvalId)
      .pipe(Effect.mapError(() => ({ _tag: 'ApprovalNotFound' as const, approvalId })))
    if (approval === undefined) {
      return yield* Effect.fail({ _tag: 'ApprovalNotFound' as const, approvalId })
    }
    if (approval.runId !== runId) {
      return yield* Effect.fail({ _tag: 'ApprovalRunMismatch' as const, approvalId, runId })
    }
    if (approval.status !== 'pending') {
      return yield* Effect.fail({
        _tag: 'ApprovalAlreadyResolved' as const,
        approvalId,
        status: approval.status,
      })
    }

    const runRepo = yield* AutomationRunRepository
    const run = yield* runRepo
      .findById(runId)
      .pipe(Effect.mapError(() => ({ _tag: 'AutomationRunNotFound' as const, runId })))
    if (run === undefined) {
      return yield* Effect.fail({ _tag: 'AutomationRunNotFound' as const, runId })
    }
    const automation = app.automations?.find((a) => a.name === run.automationName)
    if (automation === undefined) {
      return yield* Effect.fail({ _tag: 'AutomationNotFound' as const, name: run.automationName })
    }
    return {
      stepIndex: approval.stepIndex,
      automation,
      triggerData: coerceTriggerData(run.triggerData),
    }
  })

/**
 * Resolve a paused approval. On approve the run resumes (downstream actions
 * execute); on reject the paused run is finalised terminal and nothing else
 * runs. See module docstring for the full contract.
 */
export const resolveAutomationApproval = (
  options: ResolveApprovalOptions
): Effect.Effect<ResolveApprovalResult, ResolveApprovalError, ResolveRequirements> =>
  Effect.gen(function* () {
    const { runId, approvalId, decision, app, processEnv } = options
    const handlers = options.handlers ?? defaultActionHandlers

    const target = yield* loadResolutionTarget({ runId, approvalId, app })
    const approvalRepo = yield* AutomationApprovalRepository

    if (decision === 'reject') {
      // Terminate: stamp the row rejected and mark the paused run failed.
      // No re-run — the downstream actions never execute.
      yield* approvalRepo
        .updateStatus({ id: approvalId, status: 'rejected' })
        .pipe(Effect.mapError(() => ({ _tag: 'ApprovalNotFound' as const, approvalId })))
      const runRepo = yield* AutomationRunRepository
      yield* runRepo
        .updateStatus({ id: runId, status: 'rejected' })
        .pipe(Effect.mapError(() => ({ _tag: 'AutomationRunNotFound' as const, runId })))
      return { decision: 'rejected', runId, approvalId } as const
    }

    // Approve: stamp the row approved, then resume by re-running the tail.
    yield* approvalRepo
      .updateStatus({ id: approvalId, status: 'approved' })
      .pipe(Effect.mapError(() => ({ _tag: 'ApprovalNotFound' as const, approvalId })))

    const { name } = target.automation
    const automationId = yield* resolveAutomationId(name, target.automation).pipe(
      Effect.mapError(() => ({ _tag: 'AutomationNotFound' as const, name }))
    )
    const skipActionNames = collectActionsUpToIndex(
      target.automation.actions as readonly { readonly name?: unknown }[],
      target.stepIndex
    )
    const result = yield* executeAutomationRun({
      name,
      automation: target.automation,
      automationId,
      app,
      processEnv,
      triggerData: target.triggerData,
      handlers,
      // The resume runs system-side (no caller user) — the original trigger's
      // context is reused via the persisted `triggerData`, not a session.
      userId: undefined,
      skipActionNames,
    })
    return { decision: 'approved', runId, approvalId, result } as const
  })
