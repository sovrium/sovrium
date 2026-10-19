/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a browser step that paused in its middle (a `confirm`, an agent's held
 * submission) had read, kept for the same step once it resumes.
 *
 * The step's file inputs (`step-file-inputs.ts`) and whether its pages loaded
 * anything from the app itself (`browser-own-app.ts`) decide the standing of
 * every picture it stores. A resume runs the step again in a fresh tally, so
 * without this it would forget a stored file it uploaded before the pause, and
 * its later pictures would count as built from nothing. The state is stored
 * with the paused run beside its file ledgers (`run-ledger-persistence.ts`),
 * never in the step's output, which run readers see. A stored key's standing
 * is judged again against the restored ledger when it is read.
 */

import type { StepFileInput } from './step-file-inputs'

/** A paused step's reading: its file inputs, and whether it saw the app itself. */
export interface ParkedStepFiles {
  readonly inputs: readonly StepFileInput[]
  readonly sawOwnApp: boolean
}

/** One run's cell for the step it paused in. */
export interface ParkedStepCell {
  /** Keep the reading of the step the run pauses in. */
  readonly put: (state: ParkedStepFiles) => void
  /** The kept reading, left in place: what a pausing run stores. */
  readonly peek: () => ParkedStepFiles | undefined
  /** The kept reading, taken out: what the resumed step starts from, once. */
  readonly take: () => ParkedStepFiles | undefined
}

/** A cell for one run: empty, or holding what a paused run stored. */
export const createParkedStepCell = (restored?: ParkedStepFiles): ParkedStepCell => {
  // A mutable slot is the point: the pausing step writes it, the run's pause stores it.
  // eslint-disable-next-line functional/prefer-immutable-types -- see above
  const slot: { state: ParkedStepFiles | undefined } = { state: restored }
  return {
    put: (state) => {
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the run's slot; see above
      slot.state = state
    },
    peek: () => slot.state,
    take: () => {
      const { state } = slot
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- as above
      slot.state = undefined
      return state
    },
  }
}
