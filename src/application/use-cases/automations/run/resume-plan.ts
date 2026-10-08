/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a run parked on a long wait continues: its plan, read from its resume
 * cursor, its step rows and the CURRENT configuration.
 *
 * The cursor's frames are matched by step name and container kind
 * (`matchResumeFrames`); any frame that no longer matches cancels the run.
 * Otherwise the run continues IN ITS OWN ROW from the paused top-level step:
 *
 *   - paused on a top-level wait step, it runs the steps after it, as the
 *     current configuration lists them, the wait step's row gaining
 *     `resumedAt`;
 *   - paused inside a loop or a path, it re-enters that container where it
 *     stood (a {@link ContainerResume}), its `waiting` row completed by the
 *     container's new record, then runs the steps after it.
 *
 * Either way the steps before the park are never run again: their outputs are
 * restored from their rows, so `{{steps.<earlier>.…}}` reads what it read.
 */

import {
  changedWhileWaitingError,
  matchResumeFrames,
  type ResumeCursor,
} from '@/domain/models/app/automations/run-resume-cursor-service'
import { resumedWaitOutput, type ContainerResume } from '../action-handlers/run-park'
import { outputsOfStored, readStoredNested } from './nested-step-record'
import type {
  CreateStepInput,
  PersistedStep,
} from '@/application/ports/repositories/automations/automation-run-repository'

type RawAction = Readonly<Record<string, unknown>>

/** A resume the run can make. */
export interface ResumeSegmentPlan {
  /** The actions the segment runs, from its first. */
  readonly actions: readonly RawAction[]
  /** The position of the first one in the run's actions. */
  readonly base: number
  /** The row of the top-level step the run paused on. */
  readonly pausedRow: number
  /** Outputs the segment starts with, by step name. */
  readonly seedOutputs: Readonly<Record<string, Record<string, unknown>>>
  /** Paused on a top-level wait: its row, completed with `resumedAt`. */
  readonly waitRow?: CreateStepInput
  /** Paused inside a loop or a path: how it re-enters. */
  readonly container?: ContainerResume
}

/** The plan, or why the run is cancelled instead. */
export type ResumePlan =
  | { readonly kind: 'resume'; readonly segment: ResumeSegmentPlan }
  | { readonly kind: 'cancel'; readonly error: string }

/** A step row as the stored-output reader takes it. */
const asStored = (row: PersistedStep) => ({
  name: row.actionName,
  output: row.output,
  ...readStoredNested(row.nested),
})

/** The row a resumed wait step is rewritten to. */
const waitRowOf = (
  row: PersistedStep,
  output: Readonly<Record<string, unknown>>
): CreateStepInput => ({
  actionName: row.actionName,
  stepIndex: row.stepIndex,
  status: row.status,
  input: row.input ?? undefined,
  output,
  ...(row.error === null ? {} : { error: row.error }),
  ...(row.logs === null ? {} : { logs: row.logs }),
  ...(row.reads === null ? {} : { reads: row.reads }),
})

/** Plan the resume of a parked run against `actions`, its current configuration. */
export const planResume = (input: {
  readonly actions: readonly RawAction[]
  readonly cursor: ResumeCursor
  readonly steps: readonly PersistedStep[]
  readonly resumedAt: string
}): ResumePlan => {
  const { actions, cursor, steps, resumedAt } = input
  const match = matchResumeFrames(actions, cursor.frames)
  if (!match.ok) return { kind: 'cancel', error: changedWhileWaitingError(match) }
  const [frame, ...inner] = cursor.frames
  const position = match.positions[0] ?? 0
  const pausedIndex = steps.findLastIndex((row) => row.actionName === frame?.step)
  const paused = steps[pausedIndex]
  const action = actions[position]
  if (frame === undefined || paused === undefined || action === undefined) {
    return { kind: 'cancel', error: 'The run could not find where it paused.' }
  }
  const seed = outputsOfStored(steps.slice(0, pausedIndex).map(asStored))
  if (inner.length === 0) {
    const output = resumedWaitOutput(action, paused.output, resumedAt)
    const segment: ResumeSegmentPlan = {
      actions: actions.slice(position + 1),
      base: position + 1,
      pausedRow: paused.stepIndex,
      seedOutputs: { ...seed, [frame.step]: output },
      waitRow: waitRowOf(paused, output),
    }
    return { kind: 'resume', segment }
  }
  const prior = { output: paused.output, nested: readStoredNested(paused.nested) }
  const container: ContainerResume = { frame, inner, prior, resumedAt }
  const segment: ResumeSegmentPlan = {
    actions: actions.slice(position),
    base: position,
    pausedRow: paused.stepIndex,
    seedOutputs: seed,
    container,
  }
  return { kind: 'resume', segment }
}
