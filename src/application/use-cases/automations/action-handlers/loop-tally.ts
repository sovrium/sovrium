/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { executedFromStored, toleratedInStored } from '../run/nested-step-record'
import { haltedOutcome } from './nested-sequence'
import { CALLER_REFUSAL } from './record-caller-gate'
import { itemLoopOutcome } from './shared'
import type { SequenceResume } from './nested-sequence'
import type { ContainerResume } from './run-park'
import type { ActionOutcome } from './shared'
import type { ExecutedStep } from '../run/types'
import type { RefusedWrite } from '@/domain/models/app/agents/agent-action-failure-service'

/**
 * The running state of a `loop/each` across its items — and, for a loop the
 * run resumes inside, the state it had reached when the run parked.
 */

/** Running state across the iteration sequence. */
export interface LoopTally {
  readonly results: readonly unknown[]
  readonly failed: number
  readonly firstError: string | undefined
  /** What the database refused in the first failed item, when it refused a value. */
  readonly firstRefusedWrite?: RefusedWrite | undefined
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

/**
 * A failed item's entry in `results`, as the run's starter reads it: an item a
 * hand-started run's database refused for a value another record holds reads
 * as any refused write does. The item's own step keeps its failure in the
 * operator's history.
 */
export const failedItemResult = (
  error: string,
  refusedWrite: RefusedWrite | undefined,
  startedByHand: boolean
): { readonly error: string } => ({
  error: refusedWrite?.unique === true && startedByHand ? CALLER_REFUSAL : error,
})

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

/**
 * Turn the tally into the step outcome. A loop with failures fails the STEP
 * (and so the run) unless the author opted into `continueOnItemError`; the
 * per-item results ride along either way so run-history records what did land.
 *
 * The RULE lives in `itemLoopOutcome` (`./shared`), shared with the four
 * `record/batch*` operators — this is the `LoopTally`-shaped adapter onto it,
 * and the only thing it adds is the loop's own output vocabulary
 * (`results`/`iterations`/`failed`) and fallback message. Note that the fold
 * ABOVE stays separate on purpose (see `foldIteration`); only the outcome rule
 * is shared, because only the outcome rule was duplicated.
 */
export const loopOutcome = (tally: LoopTally, continueOnItemError: boolean): ActionOutcome => {
  const output = { results: tally.results, iterations: tally.results.length, failed: tally.failed }
  const nestedSteps = { iterations: tally.iterations }
  // An item skipped under `continueOnItemError` is a tolerated failure: the
  // run goes on past it, and ends `completed-with-errors` rather than `completed`.
  const skipped = continueOnItemError ? tally.failed : 0
  const count = tally.tolerated + skipped
  const tolerated = count > 0 ? { toleratedFailures: count } : {}
  // A park: the loop's row waits with what it has so far, the run with it.
  if (tally.halt?.park !== undefined) {
    return { status: 'success', output, nestedSteps, park: tally.halt.park }
  }
  const halted =
    tally.halt === undefined
      ? undefined
      : haltedOutcome(tally.halt, {
          output,
          nestedSteps,
          ...tolerated,
          ...(tally.responseOverride === undefined
            ? {}
            : { responseOverride: tally.responseOverride }),
        })
  // The first refused item's facts ride with the loop's failure, so its starter is
  // shown what that item's own step shows her (`step-record.ts`).
  const refused =
    tally.firstRefusedWrite === undefined ? {} : { refusedWrite: tally.firstRefusedWrite }
  const loopFailure = itemLoopOutcome({
    failed: tally.failed,
    firstError: tally.firstError,
    output,
    continueOnItemError,
    fallbackError: 'loop.each: an item failed',
  })
  return (
    halted ?? {
      ...loopFailure,
      ...(loopFailure.status === 'failure' ? refused : {}),
      nestedSteps,
      ...tolerated,
    }
  )
}
