/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ActionOutcome, NestedStepInvoker } from './shared'
import type { RenderedActionProps } from '../run/render-action-props'
import type { ExecutedStep } from '../run/types'

/**
 * The actions of one path, or of one loop item, run as steps of the run.
 *
 * An action inside a path or a loop is an action of the run: a later action of
 * the same path or item reads its output as `{{<step>.*}}`, and a `flow/stop`,
 * a stopping `filter/continue`, an approval pause or a failure ends the
 * sequence there. What ended it is handed back so the branch or the loop can
 * end the run the same way a top-level step would.
 */

type StepOutputs = Readonly<Record<string, Record<string, unknown>>>

/** How a sequence went: what its actions produced and, if one ended it, its outcome. */
export interface SequenceRun {
  /** Outputs produced inside the sequence, by step name (nested ones included). */
  readonly outputs: StepOutputs
  /** The last action's output, `undefined` when it produced none. */
  readonly last: unknown
  /** The outcome that ended the sequence early: a failure, a stop, a filter halt or a pause. */
  readonly halt: ActionOutcome | undefined
  /** The last `responseOverride` an action of the sequence set. */
  readonly responseOverride: Readonly<Record<string, unknown>> | undefined
  /** The steps the sequence ran, in order — the failing or stopping one included. */
  readonly steps: readonly ExecutedStep[]
}

export const EMPTY_SEQUENCE: SequenceRun = {
  steps: [],
  outputs: {},
  last: undefined,
  halt: undefined,
  responseOverride: undefined,
}

/** True when this outcome ends the sequence it ran in. */
const endsSequence = (outcome: ActionOutcome): boolean =>
  outcome.status !== 'success' || outcome.returnData !== undefined || outcome.pause === true

/** Fold one settled action into the sequence. */
const settle = (
  run: SequenceRun,
  action: Readonly<Record<string, unknown>>,
  settled: { readonly outcome: ActionOutcome; readonly step: ExecutedStep }
): SequenceRun => {
  const { outcome } = settled
  const name = String(action['name'] ?? '')
  const own = name !== '' && outcome.output !== undefined ? { [name]: outcome.output } : {}
  return {
    steps: [...run.steps, settled.step],
    outputs: { ...run.outputs, ...(outcome.nestedOutputs ?? {}), ...own },
    last: outcome.output,
    halt: endsSequence(outcome) ? outcome : undefined,
    responseOverride: outcome.responseOverride ?? run.responseOverride,
  }
}

/**
 * Run `actions` in order through `runNested`. Each action's props are filled
 * in just before it runs, against the run's outputs plus those of the earlier
 * actions of this sequence (`previousSteps` also holds what the earlier paths
 * of the same branch produced).
 */
export const runNestedSequence = (input: {
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly runNested: NestedStepInvoker
  readonly previousSteps: StepOutputs
  /** Fill in one action's props, or say why it cannot run (it then fails unrun). */
  readonly fillProps: (
    action: Readonly<Record<string, unknown>>,
    previousSteps: StepOutputs
  ) => RenderedActionProps
}): Promise<SequenceRun> => {
  const { actions, runNested, previousSteps, fillProps } = input
  return actions.reduce<Promise<SequenceRun>>(async (prev, action) => {
    const run = await prev
    if (run.halt !== undefined) return run
    const reads = { ...previousSteps, ...run.outputs }
    const { props, refusal } = fillProps(action, reads)
    const refused = refusal === undefined ? {} : { refusal }
    return settle(run, action, await runNested({ action, props, previousSteps: reads, ...refused }))
  }, Promise.resolve(EMPTY_SEQUENCE))
}

/**
 * The outcome of a branch or a loop whose sequence `halt` ended it early, or
 * `undefined` for a failure — each handler words its own. A stop hands its
 * answer up, a filter halt is recorded `filtered`, a pause suspends the run.
 */
export const haltedOutcome = (
  halt: ActionOutcome,
  carried: Pick<ActionOutcome, 'output' | 'nestedOutputs' | 'nestedSteps' | 'responseOverride'>
): ActionOutcome | undefined => {
  if (halt.status === 'failure') return undefined
  if (halt.status === 'filtered') return { ...carried, status: 'filtered' }
  if (halt.returnData !== undefined) {
    return { ...carried, status: 'success', returnData: halt.returnData }
  }
  return { ...carried, status: 'success', pause: true }
}
