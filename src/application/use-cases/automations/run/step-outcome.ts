/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Single-step dispatch for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). Owns: per-step
 * prop resolution, the action-template / native-action sandbox invokers,
 * the per-action retry + timeout machinery, and the pure folds that merge
 * an action's outcome into the run accumulator.
 *
 * The `automation:call` invoker is supplied by the orchestrator as a
 * parameter (`buildAutomationInvoker`) so this module need not import
 * `run-automation.ts` — that would form an import cycle.
 */

import { type ActionOutcome } from '../action-handlers'
import { laterResponse } from '../action-handlers/response-precedence'
import { parkedAt } from '../action-handlers/run-park'
import { redactSecretsForApp } from '../redact-secrets'
import { buildStep, redactString } from './step-record'
import { type RunAccumulator, type StepContext } from './types'

/**
 * How one settled step folds into the run: its output, whether its failure
 * propagates, and the run status it leaves behind.
 */

/**
 * Last-write-wins selector for `responseOverride`: the most recent
 * `webhook/response` action shapes the synchronous response, and a
 * `flow/stop`'s own answer never replaces one already set (see
 * `response-precedence.ts`). Extracted so {@link appendStepToAccumulator}
 * stays inside the complexity cap.
 */
const pickResponseOverride = (
  outcome: ActionOutcome,
  acc: RunAccumulator
): Readonly<Record<string, unknown>> | undefined =>
  laterResponse(acc.responseOverride, outcome.responseOverride)

/**
 * `automation:return` hands back a payload AND halts the rest of the callee
 * (early-exit). Only the FIRST `return` wins — keeps the contract
 * unambiguous when an automation has two `return` actions on different
 * branches. Returns `{ returnData, halt }`: `halt` joins `acc.halted` so a
 * `return` short-circuits the reduce loop just like a filter step.
 */
const pickReturnData = (
  outcome: ActionOutcome,
  acc: RunAccumulator
): {
  readonly returnData: Readonly<Record<string, unknown>> | undefined
  readonly halt: boolean
} => {
  const isReturn = outcome.returnData !== undefined && acc.returnData === undefined
  return { returnData: isReturn ? outcome.returnData : acc.returnData, halt: isReturn }
}

/**
 * Decide whether an action's failure should propagate to the run-level
 * status. A failed action with `continueOnError: true` is treated as
 * handled (the step still records as `failure`, but the run stays
 * `success` so the dispatcher returns 200 instead of 500).
 */
const shouldPropagateFailure = (
  rawAction: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome
): boolean => outcome.status === 'failure' && rawAction['continueOnError'] !== true

/**
 * Fold a step's `output` into `{ actions, lastOutput }`: append it under
 * `stepName` AND shallow-merge it into the run's rolling `lastOutput`. A
 * step with no output (or an unnamed step) leaves both unchanged.
 */
const foldStepOutput = (
  acc: RunAccumulator,
  stepName: string,
  out: Readonly<Record<string, unknown>> | undefined
): {
  readonly actions: RunAccumulator['actions']
  readonly lastOutput: RunAccumulator['lastOutput']
} =>
  out !== undefined
    ? {
        actions: { ...acc.actions, [stepName]: out },
        lastOutput: { ...(acc.lastOutput ?? {}), ...out },
      }
    : { actions: acc.actions, lastOutput: acc.lastOutput }

/**
 * Decide the new run-level status when an action propagates a failure.
 * `'exhausted'` wins over `'failure'`: an action that consumed its full
 * retry budget marks the run as exhausted (a distinct terminal
 * status). The marker is `outcome.output.exhausted`,
 * set by {@link dispatchWithRetry} when `retry.maxAttempts > 1` and all
 * attempts failed.
 */
const resolveFailureRunStatus = (outcome: ActionOutcome): 'failure' | 'exhausted' => {
  const exhausted = outcome.output?.['exhausted']
  return exhausted === true ? 'exhausted' : 'failure'
}

/**
 * Resolve the new run-level status when a step finished. Three cases:
 *
 *  1. The step propagated a failure (no `continueOnError`) — the run becomes
 *     `'failure'` or `'exhausted'` per {@link resolveFailureRunStatus}. The
 *     downstream loop will then skip every remaining action.
 *  2. The step FAILED but declared `continueOnError: true` — the run becomes
 *     `'completed-with-errors'` (unless it was already in a terminal failure
 *     state, in which case we preserve that).
 *  3. The step succeeded (or filtered) — the run status is unchanged.
 */
const resolveRunStatusAfterStep = (
  rawAction: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome,
  acc: RunAccumulator
): RunAccumulator['runStatus'] => {
  const propagateFailure = shouldPropagateFailure(rawAction, outcome)
  if (propagateFailure) return resolveFailureRunStatus(outcome)
  // A failure that didn't propagate (continueOnError === true) downgrades the
  // run to 'completed-with-errors' — but only if no earlier step has already
  // moved it to a stronger terminal state. Failure / exhausted / timed-out
  // win over completed-with-errors so a mixed run records the worst outcome.
  if (outcome.status === 'failure' && acc.runStatus === 'success') {
    return 'completed-with-errors'
  }
  return acc.runStatus
}

/**
 * Append a step's outcome to the accumulator, recording status/error/output
 * fields. Extracted from {@link foldOutcome} to keep complexity under the
 * project cap once the `'filtered'` branch was added.
 */
const appendStepToAccumulator = (input: {
  readonly acc: RunAccumulator
  readonly rawAction: Readonly<Record<string, unknown>>
  readonly resolvedProps: Record<string, unknown>
  readonly outcome: ActionOutcome
  readonly ctx: StepContext
}): RunAccumulator => {
  const { acc, rawAction, resolvedProps, outcome, ctx } = input
  const stepName = String(rawAction['name'] ?? '')
  const out =
    outcome.output !== undefined && stepName !== ''
      ? (outcome.output as Record<string, unknown>)
      : undefined
  const propagateFailure = shouldPropagateFailure(rawAction, outcome)
  const ret = pickReturnData(outcome, acc)
  const { actions, lastOutput } = foldStepOutput(acc, stepName, out)
  return {
    steps: [...acc.steps, buildStep(rawAction, resolvedProps, outcome, ctx)],
    runStatus: resolveRunStatusAfterStep(rawAction, outcome, acc),
    runError: propagateFailure
      ? redactString(outcome.error ?? 'Action failed', ctx.app, ctx.processEnv)
      : acc.runError,
    actions,
    lastOutput,
    halted: acc.halted || ret.halt,
    responseOverride: pickResponseOverride(outcome, acc),
    returnData: ret.returnData,
  }
}

/**
 * A step that PARKED the run on a long wait — recorded (a loop or a path as
 * `waiting`), its output folded, the run `waiting-delay` with its resume
 * cursor, every later action withheld — or a resumed container that found its
 * configuration changed, which cancels the run with the reason.
 */
const suspendedOrCancelled = (input: {
  readonly acc: RunAccumulator
  readonly rawAction: Readonly<Record<string, unknown>>
  readonly resolvedProps: Readonly<Record<string, unknown>>
  readonly outcome: ActionOutcome
  readonly ctx: StepContext
}): RunAccumulator => {
  const { acc, rawAction, resolvedProps, outcome, ctx } = input
  const stepName = String(rawAction['name'] ?? '')
  const steps = [...acc.steps, buildStep(rawAction, resolvedProps, outcome, ctx)]
  if (outcome.park === undefined) {
    const runError = redactString(outcome.cancelRun ?? 'Run cancelled', ctx.app, ctx.processEnv)
    return { ...acc, steps, runStatus: 'cancelled', runError, halted: true }
  }
  const index = (ctx.resume?.base ?? 0) + acc.steps.length
  const parked = parkedAt(outcome.park, stepName, index)
  // A loop frame holds its item's value: redacted like every stored output,
  // so the cursor keeps no secret and matches the outputs it is restored with.
  const frames = redactSecretsForApp(
    parked.frames,
    ctx.app.env,
    ctx.processEnv,
    ctx.app.connections
  ) as typeof parked.frames
  const { resumeAt } = parked
  const { actions, lastOutput } = foldStepOutput(acc, stepName, outcome.output)
  return {
    ...acc,
    steps,
    runStatus: 'waiting-delay',
    actions,
    lastOutput,
    halted: true,
    park: { resumeAt, frames },
  }
}

/**
 * Fold an action's `outcome` into the run accumulator. Pure synchronous;
 * tracks `lastOutput` as a shallow merge of every step's output (later
 * steps win on key collisions; see RunAccumulator docstring).
 */
export const foldOutcome = (input: {
  readonly acc: RunAccumulator
  readonly rawAction: Readonly<Record<string, unknown>>
  readonly resolvedProps: Readonly<Record<string, unknown>>
  readonly outcome: ActionOutcome
  readonly ctx: StepContext
}): RunAccumulator => {
  const { rawAction, resolvedProps, outcome, ctx } = input
  // What the actions inside a path or a loop produced is read by later steps
  // as `{{<step>.*}}`, like any step's output; it never joins `lastOutput`.
  const acc =
    outcome.nestedOutputs === undefined
      ? input.acc
      : { ...input.acc, actions: { ...input.acc.actions, ...outcome.nestedOutputs } }
  // Filter halt: record the filter action itself with `status: 'filtered'`
  // and set runStatus to `'skipped'` so the runs-API surfaces the halt
  //. Subsequent steps remain omitted from
  // `steps[]` via the `acc.halted` short-circuit in the run loop.
  // The filter-continue contract accepts either
  // "step omitted" or "step recorded as filtered/skipped" for the
  // FOLLOWING action — recording only the filter itself is compatible.
  if (outcome.status === 'filtered') {
    return {
      ...acc,
      steps: [...acc.steps, buildStep(rawAction, resolvedProps, outcome, ctx)],
      runStatus: 'skipped',
      halted: true,
    }
  }
  if (outcome.park !== undefined || outcome.cancelRun !== undefined) {
    return suspendedOrCancelled({ ...input, acc })
  }
  // Approval pause: the `approval/request` handler returns a
  // successful outcome flagged `pause: true`. The run SUSPENDS — the approval
  // step is recorded (success, with its `output.status: 'pending'` so the
  // webhook/manual dispatcher surfaces it) but `halted` withholds every
  // subsequent action until an out-of-band approve/reject resolves the run.
  // The non-terminal `waiting-approval` status persists to the run row so the
  // resolution endpoint can identify a resumable run. `lastOutput` is still
  // folded so the synchronous response carries the pending status.
  if (outcome.pause === true) {
    const stepName = String(rawAction['name'] ?? '')
    const out =
      outcome.output !== undefined && stepName !== ''
        ? (outcome.output as Record<string, unknown>)
        : undefined
    const { actions, lastOutput } = foldStepOutput(acc, stepName, out)
    return {
      ...acc,
      steps: [...acc.steps, buildStep(rawAction, resolvedProps, outcome, ctx)],
      runStatus: 'waiting-approval',
      actions,
      lastOutput,
      halted: true,
    }
  }
  return appendStepToAccumulator({
    acc,
    rawAction,
    resolvedProps: resolvedProps as Record<string, unknown>,
    outcome,
    ctx,
  })
}
