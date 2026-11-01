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
 * dispatch fan-out; the lower-level concerns live in sibling modules under
 * `./run/` (types, step executor, prop substitution, status, persistence).
 * Public symbols are re-exported here so external callers keep importing
 * from `./run-automation`.
 */

import { Effect, Ref } from 'effect'
import {
  AutomationRepository,
  type AutomationDatabaseError,
} from '@/application/ports/repositories/automations/automation-repository'
import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import { AutomationScheduler } from '@/application/ports/services/automation-scheduler'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { TemplateEngine } from '@/application/ports/services/template-engine'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { webhookStartsByHand } from '@/domain/models/app/automations/run-starter-service'
import {
  firstTrigger,
  triggerOfType,
} from '@/domain/models/app/automations/trigger-entries-service'
import { traceAutomationRun } from '@/infrastructure/telemetry/automation-run-trace'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import { autoPauseOnFailures } from './auto-pause-on-failures'
import { expandRefActions, type ActionTemplateLike } from './expand-action-refs'
import { notifyPlatformFailure } from './notify-platform-failure'
import { loadPausedAutomationNames } from './paused-automation-names'
import { resolveRunTimeoutMs, runActionsWithTimeout } from './run/action-loop'
import { enqueueAndAdmit, type Admission } from './run/admission'
import { buildAutomationInvoker } from './run/automation-call-invoker'
import { finaliseOnAbandon } from './run/defect-finaliser'
import { dispatchFailureHandlers } from './run/failure-dispatch'
import { finalisePausableRun } from './run/run-persistence'
import { buildRunResult } from './run/run-result'
import { withPriorTolerated } from './run/run-status'
import { unlessStarterGone } from './run/starter-standing'
import { buildStepContext, withRunLedgers } from './run/step-context'
import {
  toResolvedRetry,
  type ExecuteAutomationRunInput,
  type RunAccumulator,
  type RunAutomationResult,
  type RunRequirements,
} from './run/types'
import type { TriggerData } from './resolve-trigger-data'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'
import type { Trigger } from '@/domain/models/app/automations/trigger'

type Automation = NonNullable<App['automations']>[number]

/**
 * Errors surfaced to the caller: the not-found family answers a 4xx;
 * `AutomationRegistrySeedError` (the lazy definitions seed failed) a 500; and
 * `AutomationPressDisabled` (a press its record disables, `judge-press.ts`) a 409.
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
  | { readonly _tag: 'AutomationPressDisabled'; readonly name: string; readonly message: string }

// ── re-exports: keep the public surface stable for external importers ────────

export { MAX_ERROR_LENGTH, truncateError, type ExecuteAutomationRunInput } from './run/types'
export type { RunAutomationResult } from './run/types'

/**
 * Combined service requirement for {@link executeAutomationRun}. Exported
 * so other entry points (e.g. record-event triggers) can declare the
 * exact same requirement set.
 */
export type ExecuteAutomationRunRequirements = RunRequirements

/**
 * Options bag for {@link runWebhookAutomation}: one object keeps the call site
 * readable as the run loop accumulates concerns, under `max-params`.
 */
export interface RunWebhookAutomationOptions {
  readonly name: string
  readonly app: App
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
   * Undefined when no caller user exists (a schedule, a record event); an
   * automation called from a hand-started run carries that run's starter.
   */
  readonly userId?: string
  /** The run acts as the system for a machine caller: never started by hand. */
  readonly actsAsSystem?: boolean
  /**
   * Optional callback invoked the moment the scheduler persists the
   * `'queued'` run row. The async webhook dispatcher uses this to surface
   * the DB-generated runId in its 202 response BEFORE the run loop has
   * finished.
   */
  readonly onPersisted?: (runId: string) => void
}

/**
 * Locate a webhook-triggered automation by name, with its webhook entry, and reject
 * any state that should not produce a run (missing, operationally OFF, or non-webhook).
 */
const resolveWebhookAutomation = (
  app: App,
  name: string,
  pausedNames: ReadonlySet<string>
): Effect.Effect<
  { readonly automation: Automation; readonly trigger: Trigger },
  RunAutomationError
> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  // Automations that are OFF — whether config-disabled or operationally
  // paused — are invisible to the webhook router. Both return not-found, so an
  // attacker cannot enumerate which workflows exist, nor tell the two
  // off-states apart.
  if (!isAutomationOperationallyEnabled(automation, pausedNames))
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  // The webhook ENTRY: an automation started otherwise has no webhook address.
  const trigger = triggerOfType(automation, 'webhook')
  if (trigger === undefined)
    return Effect.fail({ _tag: 'AutomationNotWebhookTriggered' as const, name })
  return Effect.succeed({ automation, trigger })
}

/**
 * Expand `$ref` actions against `app.actions[]` BEFORE the run loop —
 * the dispatch registry never sees the synthetic ref shape, only the
 * template's underlying record/http/email action with `$varName`
 * placeholders already substituted from `$vars`.
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
        trigger: firstTrigger(automation),
        actions: automation.actions,
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
  }).pipe(Effect.withSpan('automations.resolve-automation-id'))

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
  readonly run: ExecuteAutomationRunInput
  /** Set once the row is finalised, so the abandon guard does not finalise it again. */
  readonly finalised: Ref.Ref<boolean>
  readonly admission: Admission
}): Effect.Effect<
  { readonly observedRunId: string; readonly effectiveState: RunAccumulator },
  never,
  RunRequirements
> =>
  Effect.gen(function* () {
    const cancelled = yield* (yield* AutomationScheduler).isCancelled(input.runId)
    const effectiveState: RunAccumulator = cancelled
      ? {
          ...input.finalState,
          runStatus: 'cancelled',
          runError: input.finalState.runError ?? 'Run cancelled',
        }
      : input.finalState
    const finalisedId = yield* finalisePausableRun({
      runId: input.runId,
      automationId: input.automationId,
      engineStatus: effectiveState.runStatus,
      engineError: effectiveState.runError,
      triggerData: input.triggerData,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      steps: effectiveState.steps,
      userId: input.userId,
      ...(input.run.startedByHand === true ? { startedByHand: true } : {}),
      ...(input.run.startedAsGuest === true ? { startedAsGuest: true } : {}),
      source: input.run,
      ...(effectiveState.runStatus === 'waiting-delay' ? { park: effectiveState.park } : {}),
    })
    yield* Ref.set(input.finalised, true)
    const observedRunId = finalisedId ?? input.runId
    // Given back before the failure fan-out: a failure handler may run this same automation.
    yield* input.admission.releaseSlot
    yield* input.admission.unregisterCancellation
    return { observedRunId, effectiveState }
  })

/**
 * Execute the action list for a previously-resolved automation, persist the
 * run + step rows to DB.
 *
 * This is the shared loop used by every entry point (webhook, manual,
 * record-event, etc.) so the persistence and dispatch contract is identical
 * regardless of how the automation was triggered.
 */
export const executeAutomationRun = (
  input: ExecuteAutomationRunInput
): Effect.Effect<RunAutomationResult, never, RunRequirements> =>
  // Instrument the shared run-loop seam: `automation.run` child span (name +
  // terminal status) + duration/count metrics. Every trigger type funnels
  // through here, so one wrapper covers manual/webhook/cron/record-event/form.
  traceAutomationRun(
    input.name,
    Effect.gen(function* () {
      const admission = yield* enqueueAndAdmit(input)
      const { runId, admittedAt } = admission
      const finalised = yield* Ref.make(false)
      // From admission on, the run holds a slot, a canceller and a `running`
      // row. The run's scope gives the first two back however it exits; the
      // guard closes the row if it exits any way but through
      // `finaliseAndRelease` (a defect, an interruption).
      return yield* finaliseOnAbandon(runAdmitted(input, { admission, finalised }), {
        name: input.name,
        automationId: input.automationId,
        runId,
        triggerData: input.triggerData,
        admittedAt,
        userId: input.userId,
        ...(input.startedByHand === true ? { startedByHand: true } : {}),
        ...(input.startedAsGuest === true ? { startedAsGuest: true } : {}),
        finalised,
      })
    }).pipe(Effect.scoped)
  ).pipe(Effect.withSpan('automations.execute-automation-run'))

/**
 * Phase 3–5 of a run the scheduler admitted: execute the actions under the run
 * timeout, finalise the row, then fan out the failure effects. Every duration is
 * measured from `admittedAt`.
 */
const runAdmitted = (
  started: ExecuteAutomationRunInput,
  admitted: { readonly admission: Admission; readonly finalised: Ref.Ref<boolean> }
): Effect.Effect<RunAutomationResult, never, RunRequirements> =>
  Effect.gen(function* () {
    const input = withRunLedgers(started) // its ledgers, stored with it if it pauses
    const { name, automation, automationId, app, triggerData } = input
    const { admission, finalised } = admitted
    const { runId, admittedAt } = admission
    const rawActions = expandAutomationActions(app, automation)
    const skipActionNames = input.skipActionNames ?? new Set<string>()
    // Built after the queued row lands (`runId`); services captured from THIS fiber.
    const services = yield* Effect.context<RunRequirements>()
    const runProgram = (yield* AutomationFiberBridge).promiseRunner(services)
    const processEnv = yield* ProcessEnv
    const templates = yield* TemplateEngine
    const ctx = buildStepContext({ ...input, runId, runProgram, templates, processEnv })
    const steps = runActionsWithTimeout(rawActions, ctx, {
      timeoutMs: resolveRunTimeoutMs(automation, processEnv),
      skipActionNames,
      ...(input.seedOutputs === undefined ? {} : { seedOutputs: input.seedOutputs }),
      automationInvoker: boundAutomationInvoker,
    })
    // A resumed run whose starter was banned meanwhile runs no step at all.
    const ran = yield* unlessStarterGone(input, steps)
    const finishedAtDate = new Date()
    const { observedRunId, effectiveState } = yield* finaliseAndRelease({
      name,
      automationId,
      runId,
      // A failure tolerated before an approval still ends the run `completed-with-errors`.
      finalState: withPriorTolerated(ran, input.priorTolerated ?? 0),
      triggerData,
      startedAt: admittedAt,
      finishedAt: finishedAtDate,
      userId: input.userId,
      run: input,
      finalised,
      admission,
    })
    yield* dispatchPostRunFailureEffects({
      app,
      automation,
      trigger: input.trigger,
      name,
      runId: observedRunId,
      finalState: effectiveState,
      startedAtDate: admittedAt,
      finishedAtDate,
    })
    return buildRunResult(observedRunId, effectiveState, ctx)
  })

/**
 * The `automation:call` invoker, bound with this module's `executeAutomationRun` and
 * `resolveAutomationId`, threaded into every step's run context. Defined after
 * `executeAutomationRun` so the binding hits no temporal-dead-zone reference.
 */
const boundAutomationInvoker = buildAutomationInvoker({
  resolveAutomationId,
  executeAutomationRun,
})

/**
 * Post-run failure fan-out (exported for a resumed run's segment), for a run that is not itself an
 * `automation-failure` handler:
 *
 * - a run that failed (or exhausted its retries) dispatches the user-configured
 *   `automation-failure` triggers AND the platform's operator alert;
 * - a run that TIMED OUT dispatches the operator alert only. It is still NOT
 *   cascaded to the user handlers (the #97 timeout contract: a timeout is an
 *   operator concern, not a routine failure a workflow should react to) — but
 *   the operator must hear of it, so the alert gate lets it through.
 *
 * Extracted from `executeAutomationRun` to keep that generator below the
 * per-function line cap.
 */
export const dispatchPostRunFailureEffects = (input: {
  readonly app: App
  readonly automation: NonNullable<App['automations']>[number]
  /** The trigger entry that started the run: a failure handler's own run never cascades. */
  readonly trigger: Trigger
  readonly name: string
  readonly runId: string
  readonly finalState: RunAccumulator
  readonly startedAtDate: Date
  readonly finishedAtDate: Date
}): Effect.Effect<void, never, RunRequirements> =>
  Effect.gen(function* () {
    const { app, name, runId, finalState } = input
    if (input.trigger.type === 'automation-failure') return
    const timedOut = finalState.runStatus === 'timed-out'
    const failed = finalState.runStatus === 'failure' || finalState.runStatus === 'exhausted'
    if (!timedOut && !failed) return
    if (failed) yield* cascadeToFailureHandlers(input)
    // Platform operator alert —
    // analogous to Zapier's built-in "Zap failed" email. A different concern
    // from the handlers above: those are operator-defined workflows, this is the
    // platform's safety net. Errors are swallowed by `notifyPlatformFailure` so
    // a broken email path cannot re-fail the already-failed parent run.
    yield* notifyPlatformFailure({
      app,
      automationName: name,
      runId,
      error: finalState.runError ?? 'Automation failed',
      failedAt: input.finishedAtDate.toISOString(),
      kind: timedOut ? 'timed-out' : finalState.runStatus === 'exhausted' ? 'exhausted' : 'failed',
    })
    // AFTER the alert, so the operator reads why it failed before reading that
    // it was paused. A no-op unless `SOVRIUM_AUTOMATION_AUTOPAUSE` is set.
    yield* autoPauseOnFailures({ app, automationName: name })
  }).pipe(Effect.withSpan('automations.dispatch-post-run-failure-effects'))

/** Dispatch the user-configured `automation-failure` handlers for a failed run. */
const cascadeToFailureHandlers = (input: {
  readonly app: App
  readonly automation: NonNullable<App['automations']>[number]
  readonly trigger: Trigger
  readonly name: string
  readonly runId: string
  readonly finalState: RunAccumulator
  readonly startedAtDate: Date
  readonly finishedAtDate: Date
}): Effect.Effect<void, never, RunRequirements> =>
  Effect.gen(function* () {
    const { app, automation, name, runId, finalState } = input
    yield* dispatchFailureHandlers(
      {
        app,
        failedAutomationName: name,
        failedTriggerType: input.trigger.type,
        runId,
        error: finalState.runError ?? 'Automation failed',
        steps: finalState.steps,
        retryConfig: toResolvedRetry(automation.retry),
        startedAt: input.startedAtDate.toISOString(),
        failedAt: input.finishedAtDate.toISOString(),
      },
      { resolveAutomationId, executeAutomationRun }
    )
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
  triggerData = {},
  handlers = defaultActionHandlers,
  userId,
  actsAsSystem,
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
    const { automation, trigger } = yield* resolveWebhookAutomation(app, name, pausedNames)
    const automationId = yield* resolveAutomationId(name, automation)
    return yield* executeAutomationRun({
      name,
      automation,
      trigger,
      automationId,
      app,
      triggerData,
      handlers,
      userId,
      ...(webhookStartsByHand(trigger, userId, actsAsSystem) ? { startedByHand: true } : {}),
      ...(onPersisted !== undefined ? { onPersisted } : {}),
    })
  }).pipe(Effect.withSpan('automations.run-webhook-automation'))

// Manual trigger entry point lives in `./run-manual-automation.ts` so the
// per-trigger logic (role gating, custom error tags) does not bloat this
// module. Both entry points compose `executeAutomationRun` identically.
