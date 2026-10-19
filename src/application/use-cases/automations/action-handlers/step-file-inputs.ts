/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The files one step read, and the standing each one's bytes have.
 *
 * A `document/*` or `pdf/*` step builds its file from what it reads: file
 * references, a stored template, stored pictures. What it writes carries run
 * bytes only when every file it read did (`run-written-files.ts`), and its
 * `output.attachTo` in a run nobody started admits each input on its own
 * terms (`document-attach.ts`). The readers note each file here as they read
 * it, and the writer asks once the file is built.
 *
 * One tally per step attempt ({@link tallyStepFileInputs}, wrapped round every
 * handler call). A tally opened inside another — an action a code step or a
 * loop runs — also reports to the one around it, so the outer step never
 * forgets what its inner steps read. Outside any tally nothing is noted and
 * nothing counts as built from run bytes: a writer that cannot tell fails
 * closed.
 */

import { Context, Effect } from 'effect'
import type { RunWrittenFiles } from './run-written-files'

/** A record attachment a step read: the record, and the field it holds the file in. */
export interface RecordInputOrigin {
  readonly table: string
  readonly recordId: string
  readonly field: string
}

/**
 * One file a step read: whether its bytes came in with the run, or the stored
 * key whose standing the run's ledger gives when the writer asks.
 */
export type StepFileInput = {
  /** How the step's reference names it, for a refusal (`file "a.pdf"`, `asset "logo.png"`). */
  readonly label: string
  /** Set when the step read it out of a record's attachment field. */
  readonly record?: RecordInputOrigin
} & ({ readonly carriesRunBytes: boolean } | { readonly key: string })

/** Whether one input's bytes came in with the run. */
export const inputCarriesRunBytes = (
  written: RunWrittenFiles | undefined,
  input: StepFileInput
): boolean => ('key' in input ? written?.keyHasRunBytes(input.key) === true : input.carriesRunBytes)

/** The tally a step's readers report to. */
export interface StepFileInputTally {
  readonly active: boolean
  readonly note: (input: StepFileInput) => void
  readonly inputs: () => readonly StepFileInput[]
}

const IDLE_TALLY: StepFileInputTally = {
  active: false,
  note: () => undefined,
  inputs: () => [],
}

/** The tally in scope; idle outside a step. */
export const StepFileInputs = Context.Reference<StepFileInputTally>('sovrium/StepFileInputs', {
  defaultValue: () => IDLE_TALLY,
})

/** Note a file the step read. */
export const noteStepFileInput = (input: StepFileInput): Effect.Effect<void> =>
  Effect.gen(function* () {
    const tally = yield* StepFileInputs
    yield* Effect.sync(() => tally.note(input))
  }).pipe(Effect.withSpan('automations.note-step-file-input'))

/** The files the step read so far, and whether it runs inside a tally at all. */
export const stepFileInputs: Effect.Effect<{
  readonly active: boolean
  readonly inputs: readonly StepFileInput[]
}> = Effect.gen(function* () {
  const tally = yield* StepFileInputs
  return { active: tally.active, inputs: tally.inputs() }
}).pipe(Effect.withSpan('automations.step-file-inputs'))

/**
 * Whether what the step built carries run bytes: inside a tally, when every
 * file it read did (none read — data alone — counts); outside one, never.
 */
export const builtFromStepRunBytes = (
  written: RunWrittenFiles | undefined
): Effect.Effect<boolean> =>
  Effect.map(
    stepFileInputs,
    ({ active, inputs }) => active && inputs.every((input) => inputCarriesRunBytes(written, input))
  ).pipe(Effect.withSpan('automations.built-from-step-run-bytes'))

/** Run one step attempt inside a fresh tally, which also reports to any tally around it. */
export const tallyStepFileInputs = <A, E, R>(
  step: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const outer = yield* StepFileInputs
    // The tally's own list: the readers append to it while the step runs.
    // eslint-disable-next-line functional/prefer-immutable-types -- see above
    const read: StepFileInput[] = []
    const tally: StepFileInputTally = {
      active: true,
      note: (input) => {
        // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, no-restricted-syntax -- see `read`
        read.push(input)
        // The outer step read it too.
        return outer.note(input)
      },
      inputs: () => [...read],
    }
    return yield* step.pipe(Effect.provideService(StepFileInputs, tally))
  }).pipe(Effect.withSpan('automations.tally-step-file-inputs'))
