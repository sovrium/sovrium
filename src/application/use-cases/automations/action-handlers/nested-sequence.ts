/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  executedFromStored,
  outputsOfStored,
  type StoredNestedStep,
} from '../run/nested-step-record'
import { laterResponse } from './response-precedence'
import { parkedAt, resumedWaitOutput } from './run-park'
import type { ActionOutcome, NestedStepInvoker } from './shared'
import type { RenderedActionProps } from '../run/render-action-props'
import type { ExecutedStep } from '../run/types'
import type { ResumeFrame } from '@/domain/models/app/automations/run-resume-cursor-service'

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
  outcome.status !== 'success' ||
  outcome.returnData !== undefined ||
  outcome.pause === true ||
  outcome.park !== undefined

/** Fold one settled action into the sequence. */
const settle = (
  run: SequenceRun,
  action: Readonly<Record<string, unknown>>,
  settled: { readonly outcome: ActionOutcome; readonly step: ExecutedStep },
  index: number
): SequenceRun => {
  const name = String(action['name'] ?? '')
  // A park crossing this sequence gains the frame of the step that parked it.
  const outcome =
    settled.outcome.park === undefined
      ? settled.outcome
      : { ...settled.outcome, park: parkedAt(settled.outcome.park, name, index) }
  const own = name !== '' && outcome.output !== undefined ? { [name]: outcome.output } : {}
  return {
    steps: [...run.steps, settled.step],
    outputs: { ...run.outputs, ...(outcome.nestedOutputs ?? {}), ...own },
    last: outcome.output,
    halt: endsSequence(outcome) ? outcome : undefined,
    responseOverride: laterResponse(run.responseOverride, outcome.responseOverride),
  }
}

/** Where a resumed sequence re-enters: the frames from its own step down, and what it had run. */
export interface SequenceResume {
  readonly frames: readonly ResumeFrame[]
  /** The steps the sequence had run when the run parked, as its container's row keeps them. */
  readonly prior: readonly StoredNestedStep[]
  /** When the run resumed (ISO 8601). */
  readonly resumedAt: string
}

type SequenceInput = {
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly runNested: NestedStepInvoker
  readonly previousSteps: StepOutputs
  /** Fill in one action's props, or say why it cannot run (it then fails unrun). */
  readonly fillProps: (
    action: Readonly<Record<string, unknown>>,
    previousSteps: StepOutputs
  ) => RenderedActionProps
  /** Set when the run resumes inside this sequence. */
  readonly resume?: SequenceResume
}

/** Run one action of the sequence through `runNested` and fold it in. */
const runOne = async (
  input: SequenceInput,
  run: SequenceRun,
  action: Readonly<Record<string, unknown>>,
  extra: { readonly index: number; readonly resume?: Parameters<NestedStepInvoker>[0]['resume'] }
): Promise<SequenceRun> => {
  const reads = { ...input.previousSteps, ...run.outputs }
  const { props, refusal, authored, templateVars } = input.fillProps(action, reads)
  const refused = refusal === undefined ? {} : { refusal }
  const asWritten = authored === true ? { authored } : {}
  const vars = templateVars === undefined ? {} : { templateVars }
  const resumed = extra.resume === undefined ? {} : { resume: extra.resume }
  const nested = { action, props, previousSteps: reads, ...refused, ...asWritten, ...vars }
  return settle(run, action, await input.runNested({ ...nested, ...resumed }), extra.index)
}

/** Run `actions` from position `from` on, each once, stopping at the first that ends the sequence. */
const runFrom = (input: SequenceInput, start: Promise<SequenceRun>, from: number) =>
  input.actions.slice(from).reduce<Promise<SequenceRun>>(async (prev, action, offset) => {
    const run = await prev
    if (run.halt !== undefined) return run
    return runOne(input, run, action, { index: from + offset })
  }, start)

/**
 * Run `actions` in order through `runNested`. Each action's props are filled
 * in just before it runs, against the run's outputs plus those of the earlier
 * actions of this sequence (`previousSteps` also holds what the earlier paths
 * of the same branch produced). A resumed sequence starts where it parked.
 */
export const runNestedSequence = (input: SequenceInput): Promise<SequenceRun> =>
  input.resume === undefined
    ? runFrom(input, Promise.resolve(EMPTY_SEQUENCE), 0)
    : resumeSequence(input, input.resume)

/** The sequence as it stood at the park: the steps it had run before its paused one. */
const priorRun = (prior: readonly StoredNestedStep[]): SequenceRun => ({
  ...EMPTY_SEQUENCE,
  steps: prior.map(executedFromStored),
  outputs: outputsOfStored(prior),
  last: prior.at(-1)?.output,
})

/**
 * Re-enter a sequence where the run parked: its steps before the paused one
 * keep their records and outputs; a paused wait step completes with
 * `resumedAt`, a paused loop or path is re-entered where it stood; then the
 * sequence goes on from the step after it, as it reads in the CURRENT body.
 */
const resumeSequence = async (input: SequenceInput, resume: SequenceResume) => {
  const [frame, ...inner] = resume.frames
  const position = input.actions.findIndex((action) => action['name'] === frame?.step)
  const action = input.actions[position]
  const anchor = resume.prior.findLastIndex((step) => step.name === frame?.step)
  const paused = resume.prior[anchor]
  if (frame === undefined || action === undefined || paused === undefined) {
    const error = `The automation changed while the run was waiting: '${frame?.step ?? ''}' is gone.`
    const halt: ActionOutcome = { status: 'failure', error, cancelRun: error }
    return { ...priorRun(resume.prior), halt }
  }
  const before = priorRun(resume.prior.slice(0, anchor))
  if (inner.length === 0) {
    const output = resumedWaitOutput(action, paused.output, resume.resumedAt)
    const step = { ...executedFromStored(paused), output }
    const resumed = settle(
      before,
      action,
      { outcome: { status: 'success', output }, step },
      position
    )
    return runFrom(input, Promise.resolve(resumed), position + 1)
  }
  const container = {
    frame,
    inner,
    prior: { output: paused.output, nested: paused },
    resumedAt: resume.resumedAt,
  }
  const reentered = runOne(input, before, action, { index: position, resume: container })
  return runFrom(input, reentered, position + 1)
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
  // A resumed container whose configuration changed cancels the whole run.
  if (halt.cancelRun !== undefined) {
    return { ...carried, status: 'failure', error: halt.cancelRun, cancelRun: halt.cancelRun }
  }
  if (halt.status === 'failure') return undefined
  if (halt.status === 'filtered') return { ...carried, status: 'filtered' }
  if (halt.returnData !== undefined) {
    return { ...carried, status: 'success', returnData: halt.returnData }
  }
  return { ...carried, status: 'success', pause: true }
}
