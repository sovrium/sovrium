/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

const coerceTriggerData = (raw: unknown): TriggerData => {
  if (raw === null || raw === undefined || typeof raw !== 'object') return {}
  return raw as TriggerData
}

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

export const resolveAutomationApproval = (
  options: ResolveApprovalOptions
): Effect.Effect<ResolveApprovalResult, ResolveApprovalError, ResolveRequirements> =>
  Effect.gen(function* () {
    const { runId, approvalId, decision, app, processEnv } = options
    const handlers = options.handlers ?? defaultActionHandlers

    const target = yield* loadResolutionTarget({ runId, approvalId, app })
    const approvalRepo = yield* AutomationApprovalRepository

    if (decision === 'reject') {
      yield* approvalRepo
        .updateStatus({ id: approvalId, status: 'rejected' })
        .pipe(Effect.mapError(() => ({ _tag: 'ApprovalNotFound' as const, approvalId })))
      const runRepo = yield* AutomationRunRepository
      yield* runRepo
        .updateStatus({ id: runId, status: 'rejected' })
        .pipe(Effect.mapError(() => ({ _tag: 'AutomationRunNotFound' as const, runId })))
      return { decision: 'rejected', runId, approvalId } as const
    }

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
      userId: undefined,
      skipActionNames,
    })
    return { decision: 'approved', runId, approvalId, result } as const
  })
