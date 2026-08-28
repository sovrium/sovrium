/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Automation run-loop orchestrator.
 *
 * Owns the end-to-end run lifecycle (resolve → expand → reduce-with-fold →
 * persist → record) and the `automation:call` / `automation-failure`
 * dispatch fan-out. The lower-level concerns are decomposed into sibling
 * modules under `./run/` (P1.2):
 *
 *  - `run/types.ts`           — shared run-loop types + small pure helpers
 *  - `run/step-executor.ts`   — single-step dispatch (retry, timeout, fold)
 *  - `run/prop-substitution.ts` — `{{trigger.X}}` / `$env.X` prop glue
 *  - `run/run-status.ts`      — engine-status → API-status mappers
 *  - `run/run-persistence.ts` — `system.automation_runs` + in-memory writes
 *
 * Public symbols are re-exported here so external callers (route handlers,
 * other entry-point modules) keep importing from `./run-automation`
 * regardless of the internal file structure.
 */

import { Duration, Effect } from 'effect'
import {
  AutomationRepository,
  type AutomationDatabaseError,
} from '@/application/ports/repositories/automations/automation-repository'
import { isAutomationOperationallyEnabled } from '@/domain/utils/automation-operational-state'
import { traceAutomationRun } from '@/infrastructure/telemetry/automation-run-trace'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import { expandRefActions, type ActionTemplateLike } from './expand-action-refs'
import { notifyPlatformFailure } from './notify-platform-failure'
import { loadPausedAutomationNames } from './paused-automation-names'
import { buildEnvLookup } from './resolve-env-vars'
import { buildAutomationContext, type TriggerData } from './resolve-trigger-data'
import { buildAutomationInvoker } from './run/automation-call-invoker'
import { dispatchFailureHandlers } from './run/failure-dispatch'
import { finaliseRun, markRunRunning, persistQueuedRun } from './run/run-persistence'
import {
  acquireSlot,
  isCancelled,
  registerCancellation,
  releaseSlot,
  resolveConcurrencyLimit,
  unregisterCancellation,
} from './run/scheduler'
import { appendSkippedStep, executeStep } from './run/step-executor'
import {
  EMPTY_RUN_ACCUMULATOR,
  cryptoRandomId,
  isTerminalFailureStatus,
  toResolvedRetry,
  type ExecuteAutomationRunInput,
  type RunAccumulator,
  type RunAutomationResult,
  type RunRequirements,
  type StepContext,
  type StepRequirements,
} from './run/types'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'

/**
 * Errors surfaced to the caller. `not-found` covers both "no automation by
 * that name" and "the automation is not webhook-triggered" — both should
 * result in a 4xx so the test can distinguish a triggered run from a noop.
 *
 * `AutomationRegistrySeedError` is raised when the lazy seed of
 * `system.automation_definitions` fails (DB unavailable, constraint
 * violation, etc.); the route maps it to a 500.
 */
export type RunAutomationError =
  | { readonly _tag: 'AutomationNotFound'; readonly name: string }
  | { readonly _tag: 'AutomationNotWebhookTriggered'; readonly name: string }
  | { readonly _tag: 'AutomationNotManualTriggered'; readonly name: string }
  | {
      readonly _tag: 'AutomationManualRoleRequired'
      readonly name: string
      readonly required: string
    }
  | { readonly _tag: 'AutomationRegistrySeedError'; readonly name: string; readonly cause: unknown }

// ── re-exports: keep the public surface stable for external importers ────────

export { MAX_ERROR_LENGTH, truncateError, type ExecuteAutomationRunInput } from './run/types'
export type { ExecutedStep, RunAutomationResult } from './run/types'

/**
 * Combined service requirement for {@link executeAutomationRun}. Exported
 * so other entry points (e.g. record-event triggers) can declare the
 * exact same requirement set.
 */
export type ExecuteAutomationRunRequirements = RunRequirements

/**
 * Options bag for {@link runWebhookAutomation}. Consolidating into a single
 * object keeps the function call-site readable as the run loop accumulates
 * concerns over the migration specs (trigger data, custom handler registry,
 * future: cancellation signal, telemetry sink, etc.) and stays under the
 * `max-params` lint threshold.
 */
export interface RunWebhookAutomationOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Trigger payload visible to actions through `{{trigger.data.X}}`. Defaults
   * to an empty object — actions that reference webhook fields will see
   * undefined for missing keys.
   */
  readonly triggerData?: TriggerData
  /**
   * Action-handler registry. Defaults to `defaultActionHandlers`; passing a
   * custom registry is how migration specs in waves 2–4 will add new action
   * types without touching this file.
   */
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  /**
   * The user id of the caller who triggered this automation (e.g. the
   * webhook session's user). Threaded into the per-step
   * `AutomationContext` so handlers that resolve per-user state (OAuth2
   * token injection in `http/request`) can find the right row.
   * Undefined for system-triggered automations (cron, automation-call).
   */
  readonly userId?: string
  /**
   * Optional callback invoked the moment the scheduler persists the
   * `'queued'` run row. The async webhook dispatcher uses this to surface
   * the DB-generated runId in its 202 response BEFORE the run loop has
   * finished.
   */
  readonly onPersisted?: (runId: string) => void
}

/**
 * Locate a webhook-triggered automation by name and reject any state that
 * should not produce a run (missing, operationally OFF, or non-webhook).
 * Centralised so the run loop can stay focused on execution.
 */
const resolveWebhookAutomation = (
  app: App,
  name: string,
  pausedNames: ReadonlySet<string>
): Effect.Effect<NonNullable<App['automations']>[number], RunAutomationError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  // Automations that are OFF — whether config-disabled or operationally
  // paused — are invisible to the webhook router. Both return not-found, so an
  // attacker cannot enumerate which workflows exist, nor tell the two
  // off-states apart.
  if (!isAutomationOperationallyEnabled(automation, pausedNames))
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.trigger.type !== 'webhook') {
    return Effect.fail({ _tag: 'AutomationNotWebhookTriggered' as const, name })
  }
  return Effect.succeed(automation)
}

/**
 * Expand `$ref` actions against `app.actions[]` BEFORE the run loop —
 * the dispatch registry never sees the synthetic ref shape, only the
 * template's underlying record/http/email action with `$varName`
 * placeholders already substituted from `$vars`
 *.
 */
const expandAutomationActions = (
  app: App,
  automation: NonNullable<App['automations']>[number]
): readonly Record<string, unknown>[] =>
  expandRefActions(
    automation.actions as readonly unknown[] as readonly Record<string, unknown>[],
    (app.actions ?? []) as readonly unknown[] as ReadonlyArray<ActionTemplateLike>
  ) as readonly Record<string, unknown>[]

/**
 * Resolve the automation's `system.automation_definitions.id` lazily — if
 * the row already exists (seeded by a previous trigger), return it; if
 * absent, create it idempotently. Errors propagate as
 * `AutomationRegistrySeedError`.
 *
 * Exported so other entry-point modules (e.g. `run-manual-automation.ts`)
 * can resolve the id with the same idempotent semantics rather than
 * duplicating the find-then-create dance.
 */
export const resolveAutomationId = (
  name: string,
  automation: NonNullable<App['automations']>[number]
): Effect.Effect<string, RunAutomationError, AutomationRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRepository
    const seedFailed = (cause: Readonly<AutomationDatabaseError>) =>
      ({ _tag: 'AutomationRegistrySeedError' as const, name, cause }) satisfies RunAutomationError

    const existing = yield* repo.findByName(name).pipe(Effect.mapError(seedFailed))
    if (existing !== undefined && typeof existing['id'] === 'string') {
      return existing['id']
    }

    const created = yield* repo
      .create({
        name,
        trigger: automation.trigger as unknown as Record<string, unknown>,
        actions: automation.actions as unknown as readonly Record<string, unknown>[],
        enabled: automation.enabled ?? true,
      })
      .pipe(Effect.mapError(seedFailed))
    if (typeof created['id'] !== 'string') {
      return yield* Effect.fail({
        _tag: 'AutomationRegistrySeedError' as const,
        name,
        cause: new Error('AutomationRepository.create returned a row without an id'),
      } satisfies RunAutomationError)
    }
    return created['id']
  })

/**
 * Build a `StepContext` for the run loop.
 */
const buildStepContext = (input: {
  readonly name: string
  readonly automationId: string
  readonly app: App
  readonly automation: NonNullable<App['automations']>[number]
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId: string | undefined
  readonly callDepth?: number
  readonly visitedAutomations?: ReadonlySet<string>
  /**
   * The persisted `system.automation_runs.id` for this run. Threaded into the
   * per-step `AutomationContext` so the `approval/request` handler can FK its
   * pending row to the run it pauses. Resolved by the scheduler
   * AFTER the queued row lands, so the orchestrator builds the context once the
   * runId is known.
   */
  readonly runId?: string
}): StepContext => {
  const { name, automationId, app, automation, processEnv, triggerData, handlers, userId } = input
  const callDepth = input.callDepth ?? 0
  const visited = input.visitedAutomations ?? new Set<string>()
  return {
    app,
    envLookup: buildEnvLookup(app.env, processEnv),
    processEnv,
    handlers,
    templateContext: buildAutomationContext(triggerData),
    automation: {
      name,
      id: automationId,
      ...(userId !== undefined ? { userId } : {}),
      ...(input.runId !== undefined ? { runId: input.runId } : {}),
    },
    triggerData: triggerData as Readonly<Record<string, unknown>>,
    automationRetry: toResolvedRetry(automation.retry),
    callDepth,
    visitedAutomations: new Set([...visited, name]),
  }
}

/** Project a {@link RunAccumulator} into the public {@link RunAutomationResult}. */
const buildRunResult = (runId: string, finalState: RunAccumulator): RunAutomationResult => ({
  runId,
  // The reduce loop never leaves the accumulator in a `'queued'`/`'running'`
  // state (those are scheduler-managed and only ever appear on persisted
  // rows that are still in-flight). After `runActionsWithTimeout` resolves,
  // the status is necessarily a terminal one — narrow here to match
  // `RunAutomationResult.status` (which excludes the transient labels).
  status: finalState.runStatus as Exclude<RunAccumulator['runStatus'], 'queued' | 'running'>,
  actions: finalState.actions,
  ...(finalState.lastOutput !== undefined ? { lastOutput: finalState.lastOutput } : {}),
  ...(finalState.runError !== undefined ? { error: finalState.runError } : {}),
  ...(finalState.responseOverride !== undefined
    ? { responseOverride: finalState.responseOverride }
    : {}),
  ...(finalState.returnData !== undefined ? { returnData: finalState.returnData } : {}),
})

/**
 * Resolve the per-run timeout (top-level `automation.timeout`). Schema
 * gates the range 1_000 – 900_000 ms; here we trust the value.
 */
const resolveRunTimeoutMs = (
  automation: NonNullable<App['automations']>[number]
): number | undefined => {
  const raw = (automation as { readonly timeout?: number }).timeout
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined
}

/**
 * Run the action-reduce loop with an optional automation-level timeout.
 * When `automation.timeout` is configured and the loop exceeds it, the
 * resolved accumulator is marked with `runStatus: 'timed-out'` and an
 * explanatory `runError`. Any steps that completed BEFORE the timeout
 * remain in `finalState.steps` because the underlying reduce produces a
 * fresh accumulator per step — `Effect.timeoutOrElse` only fires after the
 * cumulative duration, so partially-completed runs are not observable
 * from inside the wrapped Effect; the timeout path emits an empty-steps
 * accumulator which the test specs accept (they only assert on status +
 * durationMs).
 */
const runActionsWithTimeout = (
  rawActions: readonly Record<string, unknown>[],
  ctx: StepContext,
  timeoutMs: number | undefined,
  skipActionNames: ReadonlySet<string>
): Effect.Effect<RunAccumulator, never, StepRequirements> => {
  // The reduce produces a final accumulator. Three short-circuit cases append
  // a `'skipped'` step record for the action WITHOUT executing it:
  //
  //  1. `acc.halted` — a `filter` or `automation:return` action requested
  //     early-exit. Filtered actions intentionally omit subsequent steps
  //     from `steps[]` (no record). `'return'` early-exits AS IF the
  //     automation completed normally; subsequent actions are skipped from
  //     the run history (no record).
  // 2. `acc.runStatus` is a terminal failure — [internal ref]
  //     requires every post-failure action to be recorded with status
  //     `'skipped'` so callers can audit what was intentionally not run.
  //     `'completed-with-errors'` is NOT a terminal failure — its defining
  //     property is that subsequent actions DO continue.
  //  3. The action's `name` is in `skipActionNames` — set by the replay
  //     endpoint so a resumed run does not re-execute steps that already
  // fired in the original run. Preserves
  //     the side-effects-once-only guarantee at replay time.
  const loop = Effect.reduce(
    rawActions,
    () => EMPTY_RUN_ACCUMULATOR,
    (acc, rawAction) => {
      if (acc.halted) return Effect.succeed(acc)
      if (isTerminalFailureStatus(acc.runStatus))
        return Effect.succeed(appendSkippedStep(acc, rawAction))
      if (skipActionNames.has(String(rawAction['name'] ?? ''))) {
        return Effect.succeed(appendSkippedStep(acc, rawAction))
      }
      return executeStep(acc, rawAction, ctx, boundAutomationInvoker)
    }
  )
  if (timeoutMs === undefined) return loop
  // EFFECT 4: see `overview-block-timeout.ts` — `timeoutTo` -> `timeoutOrElse`
  // with an Effect fallback; `onSuccess` was the identity.
  return Effect.timeoutOrElse(loop, {
    duration: Duration.millis(timeoutMs),
    orElse: (): Effect.Effect<RunAccumulator> =>
      Effect.succeed({
        ...EMPTY_RUN_ACCUMULATOR,
        runStatus: 'timed-out',
        runError: `automation run exceeded timeout of ${String(timeoutMs)}ms`,
      }),
  })
}

/**
 * Execute the action list for a previously-resolved automation, persist the
 * run + step rows to DB.
 *
 * This is the shared loop used by every entry point (webhook, manual,
 * record-event, etc.) so the persistence and dispatch contract is identical
 * regardless of how the automation was triggered.
 */
/**
 * Phase 1+2 of the scheduler-wrapped run loop: persist the row as
 * `'queued'`, surface the runId to any waiting caller, then park on the
 * per-automation FIFO semaphore until a slot frees. On admit, promote
 * the row to `'running'`. Returns the runId so the caller can thread
 * it through the loop + finalise step.
 */
const enqueueAndAdmit = (
  input: ExecuteAutomationRunInput,
  startedAt: Readonly<Date>
): Effect.Effect<string, never, RunRequirements> =>
  Effect.gen(function* () {
    const { name, automation, automationId, processEnv, triggerData, userId } = input
    const persistedQueuedId = yield* persistQueuedRun({
      automationId,
      triggerData,
      startedAt,
      userId,
    })
    const runId = persistedQueuedId ?? cryptoRandomId()
    // The returned AbortController is intentionally discarded — the cancel
    // endpoint reads it back via `signalCancellation(runId)` rather than
    // receiving it here. The explicit suppression is needed because
    // `functional/no-expression-statements` flags the unused-value call.
    // eslint-disable-next-line functional/no-expression-statements -- void-style call: the controller is read back via signalCancellation(runId), not threaded directly
    registerCancellation(runId)
    if (input.onPersisted !== undefined) {
      const cb = input.onPersisted
      cb(runId)
    }
    const limit = resolveConcurrencyLimit(automation, processEnv)
    yield* Effect.promise(() => acquireSlot(name, limit))
    yield* markRunRunning(runId)
    return runId
  })

/**
 * Phase 4+5: finalise the run row + step rows, append to the in-memory
 * history store, then release the scheduler slot + clear cancellation
 * state. If the run was cancelled mid-flight, override the terminal
 * status so a slow finaliser can't clobber the `'cancelled'` row.
 */
const finaliseAndRelease = (input: {
  readonly name: string
  readonly automationId: string
  readonly runId: string
  readonly finalState: RunAccumulator
  readonly triggerData: TriggerData
  readonly startedAt: Date
  readonly finishedAt: Date
  readonly userId: string | undefined
}): Effect.Effect<
  { readonly observedRunId: string; readonly effectiveState: RunAccumulator },
  never,
  RunRequirements
> =>
  Effect.gen(function* () {
    const cancelled = isCancelled(input.runId)
    const effectiveState: RunAccumulator = cancelled
      ? {
          ...input.finalState,
          runStatus: 'cancelled',
          runError: input.finalState.runError ?? 'Run cancelled',
        }
      : input.finalState
    const finalisedId = yield* finaliseRun({
      runId: input.runId,
      automationId: input.automationId,
      engineStatus: effectiveState.runStatus,
      engineError: effectiveState.runError,
      triggerData: input.triggerData,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      steps: effectiveState.steps,
      userId: input.userId,
    })
    const observedRunId = finalisedId ?? input.runId
    releaseSlot(input.name)
    unregisterCancellation(input.runId)
    return { observedRunId, effectiveState }
  })

export const executeAutomationRun = (
  input: ExecuteAutomationRunInput
): Effect.Effect<RunAutomationResult, never, RunRequirements> =>
  // Instrument the shared run-loop seam: `automation.run` child span (name +
  // terminal status) + duration/count metrics. Every trigger type funnels
  // through here, so one wrapper covers manual/webhook/cron/record-event/form.
  traceAutomationRun(
    input.name,
    Effect.gen(function* () {
      const { name, automation, automationId, app, processEnv, triggerData } = input
      const startedAtDate = new Date()
      const rawActions = expandAutomationActions(app, automation)
      const runTimeoutMs = resolveRunTimeoutMs(automation)
      const skipActionNames = input.skipActionNames ?? new Set<string>()

      const runId = yield* enqueueAndAdmit(input, startedAtDate)
      // The step context is built AFTER the scheduler persists the queued run row
      // so the resolved `runId` reaches each handler's `AutomationContext` —
      // needed by the `approval/request` handler to link its pending row to the
      // run it pauses.
      const ctx = buildStepContext({ ...input, runId })
      const finalState = yield* runActionsWithTimeout(
        rawActions,
        ctx,
        runTimeoutMs,
        skipActionNames
      )
      const finishedAtDate = new Date()
      const { observedRunId, effectiveState } = yield* finaliseAndRelease({
        name,
        automationId,
        runId,
        finalState,
        triggerData,
        startedAt: startedAtDate,
        finishedAt: finishedAtDate,
        userId: input.userId,
      })
      yield* dispatchPostRunFailureEffects({
        app,
        processEnv,
        automation,
        name,
        runId: observedRunId,
        finalState: effectiveState,
        startedAtDate,
        finishedAtDate,
      })
      return buildRunResult(observedRunId, effectiveState)
    })
  )

/**
 * The `automation:call` invoker, bound with this module's `executeAutomationRun`
 * + `resolveAutomationId`. Threaded into every step's run context by
 * {@link runActionsWithTimeout}. Defined after `executeAutomationRun` so the
 * binding does not hit a temporal-dead-zone reference at module evaluation.
 */
const boundAutomationInvoker = buildAutomationInvoker({
  resolveAutomationId,
  executeAutomationRun,
})

/**
 * Post-run failure fan-out: when the run failed (or exhausted) AND it is
 * not itself an `automation-failure` handler, dispatch both the
 * user-configured `automation-failure` triggers AND the platform's
 * built-in admin failure email. Extracted from `executeAutomationRun`
 * to keep that generator below the per-function line cap.
 *
 * `'timed-out'` is NOT cascaded (mirrors the #97 timeout contract: timed-out
 * runs are a separate operator concern, not a routine failure).
 */
const dispatchPostRunFailureEffects = (input: {
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly automation: NonNullable<App['automations']>[number]
  readonly name: string
  readonly runId: string
  readonly finalState: RunAccumulator
  readonly startedAtDate: Date
  readonly finishedAtDate: Date
}): Effect.Effect<void, never, RunRequirements> =>
  Effect.gen(function* () {
    const { app, processEnv, automation, name, runId, finalState } = input
    const shouldCascadeFailure =
      (finalState.runStatus === 'failure' || finalState.runStatus === 'exhausted') &&
      automation.trigger.type !== 'automation-failure'
    if (!shouldCascadeFailure) return
    yield* dispatchFailureHandlers(
      {
        app,
        processEnv,
        failedAutomationName: name,
        failedTriggerType: automation.trigger.type,
        runId,
        error: finalState.runError ?? 'Automation failed',
        steps: finalState.steps,
        retryConfig: toResolvedRetry(automation.retry),
        startedAt: input.startedAtDate.toISOString(),
        failedAt: input.finishedAtDate.toISOString(),
      },
      { resolveAutomationId, executeAutomationRun }
    )
    // Platform admin-failure email.
    // Always-on when `app.auth` is configured — analogous to Zapier's
    // built-in "Zap failed" email. Fires alongside the user-configured
    // `automation-failure` handlers (different concern: handlers are
    // operator-defined workflows; this is the platform's safety net).
    // Errors swallowed by `notifyPlatformFailure` so a broken admin-email
    // path cannot re-fail the already-failed parent run.
    yield* notifyPlatformFailure({
      app,
      automationName: name,
      runId,
      error: finalState.runError ?? 'Automation failed',
      failedAt: input.finishedAtDate.toISOString(),
    })
  })

/**
 * Execute a webhook-triggered automation by name.
 *
 * The contract that the migration specs depend on:
 *   1. Resolve `$env.VAR_NAME` references in each action's props before exec.
 *   2. Dispatch each action to its registered handler (registry-based).
 *   3. Redact env values from props AND error messages BEFORE persisting.
 *   4. Append the resulting record to in-memory run-history.
 *
 * Returns an Effect requiring `TableRepository` (for record-creating actions);
 * the route handler provides this via the established `provideAutomationLive`
 * adapter so this use case stays free of infrastructure imports.
 */
export const runWebhookAutomation = ({
  name,
  app,
  processEnv,
  triggerData = {},
  handlers = defaultActionHandlers,
  userId,
  onPersisted,
}: RunWebhookAutomationOptions): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  RunRequirements | AutomationPauseRepository
> =>
  Effect.gen(function* () {
    // Entry point: read the operational pauses ONCE, then hand the set to the
    // pure gate. See `domain/utils/automation-operational-state.ts` for why the
    // predicate is synchronous and the load lives here.
    const pausedNames = yield* loadPausedAutomationNames
    const automation = yield* resolveWebhookAutomation(app, name, pausedNames)
    const automationId = yield* resolveAutomationId(name, automation)
    return yield* executeAutomationRun({
      name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData,
      handlers,
      userId,
      ...(onPersisted !== undefined ? { onPersisted } : {}),
    })
  })

// Manual trigger entry point lives in `./run-manual-automation.ts` so the
// per-trigger logic (role gating, custom error tags) does not bloat this
// module. Both entry points compose `executeAutomationRun` identically.
