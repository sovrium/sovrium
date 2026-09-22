/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The per-item loop shared by the four `record` batch operators.
 *
 * Extracted from `record-batch.ts` so that file holds the four OPERATORS and
 * this one holds the RULE they all obey. The rule is the load-bearing part:
 * every item-array operator declares `continueOnItemError` with byte-identical
 * wording, so the default must STOP at the first failing item rather than
 * attempt the rest and report afterwards — a batch of writes that is going to
 * abort anyway should not keep committing rows past the failure. Three copies
 * of that rule is how the operators came to disagree in the first place, which
 * is exactly why it lives in one place now.
 */

import { Effect } from 'effect'
import { itemLoopOutcome } from './shared'
import type { ActionOutcome } from './shared'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'

/** What happened to one item of a batch. */
export type ItemResult =
  | { readonly kind: 'created' }
  | { readonly kind: 'updated' }
  | { readonly kind: 'failed'; readonly error: string }

export interface BatchTally {
  readonly created: number
  readonly updated: number
  readonly failed: number
  readonly firstError: string | undefined
  readonly stopped: boolean
}

/** The zero tally. A factory because Effect 4's `reduce` takes a thunk it
 *  re-evaluates per run, so the fold never shares state across runs. */
const emptyTally = (): BatchTally => ({
  created: 0,
  updated: 0,
  failed: 0,
  firstError: undefined,
  stopped: false,
})

export const failed = (error: string): ItemResult => ({ kind: 'failed', error })

const foldItemResult = (tally: BatchTally, result: ItemResult): BatchTally => ({
  created: tally.created + (result.kind === 'created' ? 1 : 0),
  updated: tally.updated + (result.kind === 'updated' ? 1 : 0),
  failed: tally.failed + (result.kind === 'failed' ? 1 : 0),
  firstError: tally.firstError ?? (result.kind === 'failed' ? result.error : undefined),
  stopped: tally.stopped,
})

/**
 * Walk the items sequentially, folding each outcome into the tally and halting
 * early once an item has failed and `continueOnItemError` is off. Sequential
 * rather than concurrent so a partial batch is a prefix of the declared order
 * — an operator can tell exactly where it stopped.
 */
export const runBatchItems = (input: {
  readonly items: readonly unknown[]
  readonly continueOnItemError: boolean
  readonly runItem: (item: unknown) => Effect.Effect<ItemResult, never, TableRepository>
}): Effect.Effect<BatchTally, never, TableRepository> =>
  Effect.reduce(input.items, emptyTally, (tally, item) =>
    tally.stopped
      ? Effect.succeed(tally)
      : input.runItem(item).pipe(
          Effect.map((result) => {
            const next = foldItemResult(tally, result)
            const halt = result.kind === 'failed' && !input.continueOnItemError
            return halt ? { ...next, stopped: true } : next
          })
        )
  ).pipe(Effect.withSpan('automations.run-batch-items'))

/**
 * Turn a tally into the action outcome. A batch with failures fails the STEP
 * (and so the run) unless the author opted into `continueOnItemError`; the
 * counts ride along either way so run-history records what did land.
 *
 * The RULE lives in `itemLoopOutcome` (`./shared`), shared with `loop/each` —
 * this is the `BatchTally`-shaped adapter onto it. The two were byte-identical
 * copies, which is how the four batch operators and the loop would come to
 * disagree about a flag whose wording is identical in all five schemas.
 */
export const batchOutcome = (input: {
  readonly tally: BatchTally
  readonly output: Record<string, unknown>
  readonly continueOnItemError: boolean
  readonly fallbackError: string
}): ActionOutcome =>
  itemLoopOutcome({
    failed: input.tally.failed,
    firstError: input.tally.firstError,
    output: input.output,
    continueOnItemError: input.continueOnItemError,
    fallbackError: input.fallbackError,
  })
