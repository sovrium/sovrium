/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The action loop of one admitted run, under the run timeout.
 *
 * Extracted from `run-automation.ts`, which keeps the lifecycle around it
 * (admission, finalisation, failure fan-out).
 */

import { Duration, Effect, Ref } from 'effect'
import { resolveAutomationDefaultTimeoutMs } from '@/domain/models/process-env/automations'
import { appendSkippedStep, executeStep } from './step-executor'
import {
  EMPTY_RUN_ACCUMULATOR,
  isTerminalFailureStatus,
  type RunAccumulator,
  type StepContext,
  type AutomationInvoker,
  type StepRequirements,
} from './types'
import type { App } from '@/domain/models/app'

/**
 * Resolve the per-run timeout: the automation's own `timeout`, else the
 * operator default (`SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS`, 15 minutes when
 * unset). The schema gates `timeout` to 1_000 – 3_600_000 ms and the boot gates
 * the variable to the same range, so every run is bounded.
 */
export const resolveRunTimeoutMs = (
  automation: NonNullable<App['automations']>[number],
  processEnv: Readonly<Record<string, string | undefined>>
): number => {
  const raw = (automation as { readonly timeout?: number }).timeout
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
    ? raw
    : resolveAutomationDefaultTimeoutMs(processEnv)
}

/** How far the action loop got: the accumulator and how many actions it has settled. */
interface LoopProgress {
  readonly acc: RunAccumulator
  readonly settled: number
}

/**
 * The accumulator of a run stopped by its timeout: every step that settled
 * before the timeout, then a `'skipped'` record for the action that was still
 * running and for every action after it — unless the run had already halted
 * (`filter`, `automation:return`), whose later actions leave no record.
 */
const timedOutAccumulator = (
  progress: LoopProgress,
  rawActions: readonly Record<string, unknown>[],
  timeoutMs: number
): RunAccumulator => {
  const base: RunAccumulator = {
    ...progress.acc,
    runStatus: 'timed-out',
    runError: `automation run exceeded timeout of ${String(timeoutMs)}ms`,
  }
  if (progress.acc.halted) return base
  return rawActions.slice(progress.settled).reduce(appendSkippedStep, base)
}

/**
 * Run the action-reduce loop under the run timeout (see
 * {@link resolveRunTimeoutMs}; every run has one). When the loop exceeds it,
 * the action in flight is interrupted and the run ends `'timed-out'` with an
 * explanatory `runError`.
 *
 * The steps that settled BEFORE the timeout are kept: each step writes its
 * accumulator into a `Ref` as it settles, and the timeout path reads it back,
 * so the run's trace shows what actually ran — then a `'skipped'` record for
 * the interrupted action and every one after it. `Effect.timeoutOrElse`
 * discards the loop's own value on timeout, which is why the progress lives
 * outside it.
 */
export const runActionsWithTimeout = (
  rawActions: readonly Record<string, unknown>[],
  ctx: StepContext,
  options: {
    readonly timeoutMs: number
    readonly skipActionNames: ReadonlySet<string>
    /** Outputs a resumed run starts with — see `ExecuteAutomationRunInput.seedOutputs`. */
    readonly seedOutputs?: Readonly<Record<string, Record<string, unknown>>>
    /** The `automation:call` invoker; passed in because it closes over the run loop itself. */
    readonly automationInvoker: (ctx: StepContext, stepIndex: number) => AutomationInvoker
  }
): Effect.Effect<RunAccumulator, never, StepRequirements> =>
  Effect.gen(function* () {
    const { timeoutMs, skipActionNames, automationInvoker } = options
    const initial: RunAccumulator =
      options.seedOutputs === undefined
        ? EMPTY_RUN_ACCUMULATOR
        : { ...EMPTY_RUN_ACCUMULATOR, actions: options.seedOutputs }
    const progress = yield* Ref.make<LoopProgress>({ acc: initial, settled: 0 })
    // The reduce produces a final accumulator. Three short-circuit cases append
    // a `'skipped'` step record for the action WITHOUT executing it:
    //
    //  1. `acc.halted` — a `filter` or `automation:return` action requested
    //     early-exit. Filtered actions intentionally omit subsequent steps
    //     from `steps[]` (no record). `'return'` early-exits AS IF the
    //     automation completed normally; subsequent actions are skipped from
    //     the run history (no record).
    //  2. `acc.runStatus` is a terminal failure
    //     requires every post-failure action to be recorded with status
    //     `'skipped'` so callers can audit what was intentionally not run.
    //     `'completed-with-errors'` is NOT a terminal failure — its defining
    //     property is that subsequent actions DO continue.
    //  3. The action's `name` is in `skipActionNames` — set by the replay
    //     endpoint so a resumed run does not re-execute steps that already
    //     fired in the original run. Preserves
    //     the side-effects-once-only guarantee at replay time.
    const step = (acc: RunAccumulator, rawAction: Readonly<Record<string, unknown>>) => {
      if (acc.halted) return Effect.succeed(acc)
      if (isTerminalFailureStatus(acc.runStatus))
        return Effect.succeed(appendSkippedStep(acc, rawAction))
      if (skipActionNames.has(String(rawAction['name'] ?? ''))) {
        return Effect.succeed(appendSkippedStep(acc, rawAction))
      }
      return executeStep(acc, rawAction, ctx, automationInvoker)
    }
    const loop = Effect.reduce(
      rawActions,
      () => initial,
      (acc, rawAction) =>
        step(acc, rawAction).pipe(
          Effect.tap((next) =>
            Ref.update(progress, (current) => ({ acc: next, settled: current.settled + 1 }))
          )
        )
    )
    // EFFECT 4: see `overview-block-timeout.ts` — `timeoutTo` -> `timeoutOrElse`
    // with an Effect fallback; `onSuccess` was the identity.
    return yield* Effect.timeoutOrElse(loop, {
      duration: Duration.millis(timeoutMs),
      orElse: () =>
        Ref.get(progress).pipe(
          Effect.map((current) => timedOutAccumulator(current, rawActions, timeoutMs))
        ),
    })
  }).pipe(Effect.withSpan('automations.run-actions-with-timeout'))
