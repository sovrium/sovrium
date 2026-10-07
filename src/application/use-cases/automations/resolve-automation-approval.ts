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
 * WHO MAY RESOLVE: only an approver the request names. The caller is
 * checked right after the row is found and BEFORE its status, and a caller
 * the request does not name fails with `ApprovalNotFound` — so a stranger gets
 * the same answer an unknown id gets, and cannot learn from a 409 that a closed
 * request exists. A missing caller (no session) is refused the same way; the
 * route answers 401 before it ever gets here.
 *
 * TIMEOUT: a request whose `expiresAt` has passed belongs to its
 * `onTimeout` (`approve` / `reject`), not to whoever answers next. A person who
 * answers late first applies the timeout's outcome — exactly as the sweep in
 * `expire-automation-approvals.ts` would — and is then refused with that
 * outcome as `ApprovalAlreadyResolved` (409). The DEADLINE decides, never the
 * tick of the sweep. `escalate`, or no `onTimeout`, leaves the request open.
 *
 * OUTPUT: the approval step reads `{ decision, resolvedBy, resolverId? }` —
 * `resolvedBy` is `user` or `timeout`, `resolverId` the account that answered.
 * It is written into the paused run's step row AND seeded into a resumed run.
 *
 * Re-running the tail with `skipActionNames` is observationally identical to
 * resuming the same run (the downstream side-effect appears) and reuses the
 * existing engine path rather than threading a half-finished accumulator
 * through a second invocation.
 */

import { Clock, Effect } from 'effect'
import { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import {
  isPersistedApprover,
  type ApprovalCaller,
} from '@/domain/models/app/automations/actions/approval/approver-validation'
import { parseRelay, type RunRelay } from '@/domain/models/app/automations/run-relay-service'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import {
  executeAutomationRun,
  resolveAutomationId,
  type ExecuteAutomationRunRequirements,
  type RunAutomationError,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { AutomationApprovalDatabaseError } from '@/application/ports/repositories/automations/automation-approval-repository'
import type { AutomationRunDatabaseError } from '@/application/ports/repositories/automations/automation-run-repository'
import type { App } from '@/domain/models/app'

/**
 * Error tags surfaced by the approval-resolution flow. Mapped to HTTP
 * responses by the route handler.
 *
 * The two repository failures are members in their own right, NOT folded into
 * `ApprovalNotFound` / `AutomationRunNotFound`. A `mapError(() => NotFound)`
 * over a repository call answers "no such approval" when the truth is "the
 * store did not answer" — a 404 for a row the caller can see, and a
 * non-alerting one for the operator. Absence is decided HERE, from an
 * `undefined` row; a failure stays a failure and reaches the route as a 5xx.
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
  | AutomationApprovalDatabaseError
  | AutomationRunDatabaseError
  | RunAutomationError

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
  /**
   * The signed-in person resolving the request. `undefined` resolves nothing:
   * the request is answered as not found.
   */
  readonly caller: ApprovalCaller | undefined
}

export type ResolveRequirements =
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

/** An approval request, located and checked against its caller and run. */
type CheckedApproval = {
  readonly stepIndex: number
  readonly status: string
  readonly expiresAt: Date | null
}

/**
 * Who the resumed run writes as. A run a person started by hand resumes as
 * that person: the approval gates WHEN the tail runs, never WHOSE
 * rights it runs with. Any other run resumes system-side, as before — and a
 * resume after a TIMEOUT reads the same record, never the sweep's context.
 */
type StartedBy =
  | { readonly startedByHand: true; readonly userId: string | undefined }
  | { readonly userId: undefined }

const startedByOf = (run: {
  readonly startedByHand: boolean
  readonly triggeredByUserId: string | null
}): StartedBy =>
  run.startedByHand
    ? { startedByHand: true, userId: run.triggeredByUserId ?? undefined }
    : { userId: undefined }

/**
 * The paused run an approval resolves: the automation it belongs to, its
 * persisted trigger payload, the request's position and deadline, and who the
 * run resumes as.
 */
export interface ApprovalRunTarget {
  readonly stepIndex: number
  readonly expiresAt: Date | null
  readonly automation: NonNullable<App['automations']>[number]
  readonly triggerData: TriggerData
  readonly startedBy: StartedBy
  /** The paused run's relay, which the resumed run keeps. */
  readonly relay: RunRelay | undefined
}

/**
 * Load the approval row, validating the caller, the link to `runId`, and that
 * the row is still pending. Checked in that order — see the module docstring.
 */
const loadCheckedApproval = (input: {
  readonly runId: string
  readonly approvalId: string
  readonly app: App
  readonly caller: ApprovalCaller | undefined
}): Effect.Effect<CheckedApproval, ResolveApprovalError, AutomationApprovalRepository> =>
  Effect.gen(function* () {
    const { runId, approvalId, app, caller } = input
    const approvalRepo = yield* AutomationApprovalRepository
    // No `mapError` here: a read that FAILED is not a read that found nothing.
    // Absence is the `undefined` below, and only that becomes `ApprovalNotFound`.
    const approval = yield* approvalRepo.findById(approvalId)
    if (approval === undefined) {
      return yield* Effect.fail({ _tag: 'ApprovalNotFound' as const, approvalId })
    }
    // BEFORE the run link and the status: a caller the request does not name
    // must get exactly what an unknown id gets, never a 409 that confirms it.
    if (caller === undefined || !isPersistedApprover(approval.approvers, caller, app)) {
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
    return approval
  })

/**
 * Load the paused run an approval links to and the automation it belongs to.
 * Shared by a person's resolution and the timeout sweep.
 */
export const loadApprovalRunTarget = (input: {
  readonly runId: string
  readonly approval: { readonly stepIndex: number; readonly expiresAt: Date | null }
  readonly app: App
}): Effect.Effect<ApprovalRunTarget, ResolveApprovalError, AutomationRunRepository> =>
  Effect.gen(function* () {
    const { runId, approval, app } = input
    const runRepo = yield* AutomationRunRepository
    const run = yield* runRepo.findById(runId)
    if (run === undefined) {
      return yield* Effect.fail({ _tag: 'AutomationRunNotFound' as const, runId })
    }
    const automation = app.automations?.find((a) => a.name === run.automationName)
    if (automation === undefined) {
      return yield* Effect.fail({ _tag: 'AutomationNotFound' as const, name: run.automationName })
    }
    return {
      stepIndex: approval.stepIndex,
      expiresAt: approval.expiresAt,
      automation,
      triggerData: coerceTriggerData(run.triggerData),
      startedBy: startedByOf(run),
      relay: parseRelay(run.relay),
    }
  }).pipe(Effect.withSpan('automations.load-approval-run-target'))

/**
 * Who resolved a request: a person (their account id, when known), or the
 * request's own timeout.
 */
export type ApprovalResolver =
  { readonly by: 'user'; readonly userId: string | undefined } | { readonly by: 'timeout' }

/**
 * Claim the still-pending request for `status`. The write is conditional on
 * `pending`, so when two callers resolve the same request at once only one
 * claims it; the other is refused with the status the winner recorded, and
 * the run resumes (or terminates) exactly once. A person's claim stamps their
 * account on the row; a timeout's stamps nobody.
 */
const claimPendingApproval = (
  approvalId: string,
  status: 'approved' | 'rejected',
  resolver: ApprovalResolver
): Effect.Effect<void, ResolveApprovalError, AutomationApprovalRepository> =>
  Effect.gen(function* () {
    const approvalRepo = yield* AutomationApprovalRepository
    const claimed = yield* approvalRepo.resolvePending({
      id: approvalId,
      status,
      ...(resolver.by === 'user' && resolver.userId !== undefined
        ? { approvedById: resolver.userId }
        : {}),
    })
    if (claimed !== undefined) return
    const current = yield* approvalRepo.findById(approvalId)
    return yield* Effect.fail({
      _tag: 'ApprovalAlreadyResolved' as const,
      approvalId,
      status: current?.status ?? status,
    })
  })

/** The paused approval step's name and its `onReject` / `onTimeout` choices. */
const approvalStepOf = (
  automation: NonNullable<App['automations']>[number],
  stepIndex: number
): { readonly name?: string; readonly onReject?: unknown; readonly onTimeout?: unknown } => {
  const step: { readonly name?: unknown; readonly props?: unknown } | undefined =
    automation.actions[stepIndex]
  const props = step?.props as
    { readonly onReject?: unknown; readonly onTimeout?: unknown } | undefined
  return {
    ...(typeof step?.name === 'string' ? { name: step.name } : {}),
    onReject: props?.onReject,
    onTimeout: props?.onTimeout,
  }
}

/**
 * The outcome a request's timeout imposes at `nowMs`: `approved` / `rejected`
 * once its deadline has passed under `onTimeout: approve` / `reject`, and
 * `undefined` while it is still open — before the deadline, with no deadline,
 * or under `escalate` / no `onTimeout`, which never close a request.
 */
export const timeoutOutcomeOf = (
  target: ApprovalRunTarget,
  nowMs: number
): 'approved' | 'rejected' | undefined => {
  if (target.expiresAt === null || target.expiresAt.getTime() > nowMs) return undefined
  const { onTimeout } = approvalStepOf(target.automation, target.stepIndex)
  if (onTimeout === 'approve') return 'approved'
  if (onTimeout === 'reject') return 'rejected'
  return undefined
}

/** The approval step's output once the request is resolved. */
const decisionOutput = (
  decision: 'approved' | 'rejected',
  resolver: ApprovalResolver
): Readonly<Record<string, unknown>> => ({
  decision,
  resolvedBy: resolver.by,
  ...(resolver.by === 'user' && resolver.userId !== undefined
    ? { resolverId: resolver.userId }
    : {}),
})

/**
 * Resolve a pending request as `decision`, by `resolver`: claim the row, write
 * the outcome into the paused run's approval step, then either end the run
 * (a rejection under `onReject: stop`) or resume it past the approval. Shared
 * by a person's answer and the timeout sweep, so both resolve identically.
 */
export const applyApprovalOutcome = (input: {
  readonly runId: string
  readonly approvalId: string
  readonly target: ApprovalRunTarget
  readonly decision: 'approved' | 'rejected'
  readonly resolver: ApprovalResolver
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
}): Effect.Effect<ResolveApprovalResult, ResolveApprovalError, ResolveRequirements> =>
  Effect.gen(function* () {
    const { runId, approvalId, target, decision, resolver, app, processEnv } = input
    const approvalStep = approvalStepOf(target.automation, target.stepIndex)
    yield* claimPendingApproval(approvalId, decision, resolver)

    // The paused run's log reads what was decided and by whom, whether or not
    // the run goes on — a rejected run is never re-run, so this is its only record.
    const output = decisionOutput(decision, resolver)
    const runRepo = yield* AutomationRunRepository
    yield* runRepo.recordStepOutput({ runId, stepIndex: target.stepIndex, output })

    if (decision === 'rejected' && approvalStep.onReject !== 'continue') {
      // Terminate: the row is rejected; mark the paused run rejected. No
      // re-run — the downstream actions never execute.
      yield* runRepo.updateStatus({ id: runId, status: 'rejected' })
      return { decision, runId, approvalId } as const
    }

    // Approve — or reject under `onReject: continue`: resume by
    // re-running the tail.
    //
    // The automation itself was already resolved from `app.automations` in
    // `loadApprovalRunTarget`, so `resolveAutomationId` cannot report it
    // missing: it looks the registry row up and CREATES it when absent, and
    // every way it fails is an `AutomationRegistrySeedError` carrying its
    // cause. Re-labelling that as `AutomationNotFound` answered 404 for a
    // registry write that failed.
    const { name } = target.automation
    const automationId = yield* resolveAutomationId(name, target.automation)
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
      handlers: input.handlers ?? defaultActionHandlers,
      // The original trigger's context is reused via the persisted
      // `triggerData`, not a session. A hand-started run resumes as its caller;
      // any other resumes system-side (no caller user).
      ...target.startedBy,
      // A hand-started run's starter may have been banned while it waited.
      checkStarterStanding: true,
      skipActionNames,
      // A later step reads the outcome as `{{<approval step>.result.decision}}`,
      // and who decided as `{{<approval step>.result.resolvedBy}}`.
      ...(approvalStep.name === undefined ? {} : { seedOutputs: { [approvalStep.name]: output } }),
      ...(target.relay === undefined ? {} : { relay: target.relay }),
    })
    return { decision, runId, approvalId, result } as const
  }).pipe(Effect.withSpan('automations.apply-approval-outcome'))

/**
 * Resolve a paused approval. On approve the run resumes (downstream actions
 * execute); on reject the paused run is finalised terminal and nothing else
 * runs. A request already past its timeout is resolved by that timeout first,
 * and the late answer is refused. See module docstring for the full contract.
 */
export const resolveAutomationApproval = (
  options: ResolveApprovalOptions
): Effect.Effect<ResolveApprovalResult, ResolveApprovalError, ResolveRequirements> =>
  Effect.gen(function* () {
    const { runId, approvalId, decision, app, processEnv, caller } = options
    const approval = yield* loadCheckedApproval({ runId, approvalId, app, caller })
    const target = yield* loadApprovalRunTarget({ runId, approval, app })
    const shared = {
      runId,
      approvalId,
      target,
      app,
      processEnv,
      ...(options.handlers === undefined ? {} : { handlers: options.handlers }),
    }

    // The deadline decides, not the sweep's tick: an answer after it applies
    // the timeout's outcome, then is refused as already decided.
    const timedOut = timeoutOutcomeOf(target, yield* Clock.currentTimeMillis)
    if (timedOut !== undefined) {
      yield* applyApprovalOutcome({ ...shared, decision: timedOut, resolver: { by: 'timeout' } })
      return yield* Effect.fail({
        _tag: 'ApprovalAlreadyResolved' as const,
        approvalId,
        status: timedOut,
      })
    }

    return yield* applyApprovalOutcome({
      ...shared,
      decision: decision === 'reject' ? 'rejected' : 'approved',
      resolver: { by: 'user', userId: caller?.userId },
    })
  }).pipe(Effect.withSpan('automations.resolve-automation-approval'))
