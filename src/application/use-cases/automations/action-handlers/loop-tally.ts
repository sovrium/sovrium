/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { executedFromStored, toleratedInStored } from '../run/nested-step-record'
import type { SequenceResume } from './nested-sequence'
import type { ContainerResume } from './run-park'
import type { ActionOutcome } from './shared'
import type { ExecutedStep } from '../run/types'

/**
 * The running state of a `loop/each` across its items — and, for a loop the
 * run resumes inside, the state it had reached when the run parked.
 */

/** Running state across the iteration sequence. */
export interface LoopTally {
  readonly results: readonly unknown[]
  readonly failed: number
  readonly firstError: string | undefined
  readonly stopped: boolean
  /** A `flow/stop`, a stopping filter, a pause or a park an item reached: it ends the run. */
  readonly halt: ActionOutcome | undefined
  readonly responseOverride: Readonly<Record<string, unknown>> | undefined
  /** Each item that ran, with the steps run for it. */
  readonly iterations: NonNullable<ExecutedStep['iterations']>
  /** Nested failures `continueOnError` let an item go past, across the items. */
  readonly tolerated: number
}

export const EMPTY_TALLY: LoopTally = {
  iterations: [],
  tolerated: 0,
  results: [],
  failed: 0,
  firstError: undefined,
  stopped: false,
  halt: undefined,
  responseOverride: undefined,
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {}

/**
 * Whether a stored `results[]` entry is a failed item's `{ error }` — its text.
 * An item whose last output carries an `error` OBJECT (a tolerated `http/*`
 * failure's `{ code, message }`) completed, and is not one.
 */
const isFailedResult = (entry: unknown): boolean => typeof asRecord(entry)['error'] === 'string'

/**
 * Where a resumed loop stands: the tally of the items it finished before the
 * park (their results, failures and steps, as its row kept them), the item it
 * paused on, and how that item's own sequence re-enters.
 */
export const resumedLoopState = (
  resume: ContainerResume
): {
  readonly tally: LoopTally
  readonly item: number
  readonly resume: SequenceResume
} => {
  const item = resume.frame.item ?? 0
  const output = asRecord(resume.prior.output)
  const stored = resume.prior.nested.iterations ?? []
  const results = Array.isArray(output['results']) ? output['results'] : []
  const failed = typeof output['failed'] === 'number' ? output['failed'] : 0
  const finished = stored.filter((iteration) => iteration.index < item)
  const tally: LoopTally = {
    ...EMPTY_TALLY,
    results: results.slice(0, item),
    failed,
    tolerated: finished.reduce(
      (sum, iteration) =>
        sum + toleratedInStored(iteration.steps, isFailedResult(results[iteration.index])),
      0
    ),
    iterations: finished.map((iteration) => ({
      index: iteration.index,
      steps: iteration.steps.map(executedFromStored),
    })),
  }
  const paused = stored.find((iteration) => iteration.index === item)
  return {
    tally,
    item,
    resume: { frames: resume.inner, prior: paused?.steps ?? [], resumedAt: resume.resumedAt },
  }
}

/**
 * Why a resumed loop cancels the run, or `undefined` when it may go on: the
 * list it walks is re-read from the current configuration, and the item at the
 * paused position must still be the one the run paused on.
 */
export const changedItemRefusal = (
  step: string,
  resume: ContainerResume,
  items: readonly unknown[]
): string | undefined => {
  const item = resume.frame.item ?? 0
  // Deep equality, not serialised text: a PostgreSQL `jsonb` cursor reads its
  // keys back in its own order, which a literal item may not share.
  return Bun.deepEquals(items[item], resume.frame.itemValue)
    ? undefined
    : `The automation changed while the run was waiting: the list '${step}' walks no longer holds the item it paused on.`
}
