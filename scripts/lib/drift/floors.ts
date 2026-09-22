/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Floors and censuses — the two things that make a GREEN drift check readable
 * as evidence rather than as an assertion (SC6).
 *
 * Thirty-seven files declare a `MIN_*` constant and then hand-write the same
 * throw beside it. The constant is the easy half; the half that varies, and
 * that a copy-paste gets wrong, is the SENTENCE — the one that says what a
 * below-floor reading means. "Walked 0 files" is not a small corpus, it is a
 * broken root, and a check that reports `ok: true` over it is worse than a
 * check that does not exist, because it is believed.
 */

import { scopeNote } from '../tool-output'

/** Thrown by {@link assertFloor}. Surfaced by `check-drift.ts` as a failed check. */
export class FloorViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FloorViolation'
  }
}

export interface FloorAssertion {
  /** The check declaring the floor, for the message (e.g. `check-island-drift`). */
  readonly check: string
  /** What was counted, as a noun phrase (e.g. `source file(s) under src/`). */
  readonly name: string
  /** The measured count. */
  readonly actual: number
  /** The floor. A reading below this is a broken instrument, not a clean tree. */
  readonly min: number
  /** Why a below-floor reading means the check is not working. Required. */
  readonly why: string
}

/**
 * The floor's SENTENCE, without the throw — `null` when the floor holds.
 *
 * For the checks that fold a below-floor reading into their own report rather
 * than aborting on it. Six of them exist and all six had hand-written the same
 * paragraph: `check-design-tokens.ts` and two siblings push it into a
 * `violations[]` that becomes the `DriftOutcome`, and the two growth checks
 * throw a domain `StructuralError` their callers already classify. Forcing
 * those onto {@link assertFloor} would change the exit code from 1 to 2 and, in
 * the reporting cases, would abort before the other findings were collected —
 * a behaviour change dressed as a refactor.
 *
 * What is shared is the half that matters and the half a copy gets wrong: the
 * sentence saying a below-floor reading is a BROKEN INSTRUMENT rather than a
 * clean tree. This returns it; the caller decides what to do with it.
 */
export const floorViolationMessage = (assertion: FloorAssertion): string | null =>
  assertion.actual >= assertion.min
    ? null
    : `${assertion.check}: counted ${assertion.actual} ${assertion.name}, below the floor of ` +
      `${assertion.min}. ${assertion.why} ` +
      'The measurement is the failure here, not the tree — confirm the root resolves and the ' +
      'patterns still match before lowering this floor.'

/**
 * Assert a population is at least `min`, or THROW.
 *
 * Throws rather than returning a failed `DriftOutcome`, deliberately: a
 * `DriftOutcome` says "I looked and found drift", and that is exactly the claim
 * a broken instrument must not be able to make. `check-drift.ts` turns the
 * throw into a loud failed check with the stack attached.
 *
 * **Floor only a population that cannot shrink on success.** A floor on a
 * BACKLOG fails the day the backlog is drained — the gate goes red for the work
 * it exists to encourage. Floor the corpus WALK, not the findings.
 */
export const assertFloor = (assertion: FloorAssertion): void => {
  const message = floorViolationMessage(assertion)
  if (message === null) return
  throw new FloorViolation(message)
}

/** Assert several floors at once, reporting the first that is violated. */
export const assertFloors = (assertions: readonly FloorAssertion[]): void => {
  for (const assertion of assertions) assertFloor(assertion)
}

/**
 * A gate's scope census: what it looked at, and what it deliberately did not.
 *
 * Printed through `scopeNote`, so it appears on a standalone run and is silent
 * under `check-drift.ts` — forty of these interleaving with the verdict journal
 * is noise squared, and on a green run every one would be computed and
 * discarded unread.
 *
 * `parts` are joined with `; ` in the order given. Put what was COVERED first
 * and what was NOT last, prefixed `not covered:` — a census that lists only the
 * coverage reads as a boast rather than as a scope.
 */
export const censusLine = (tag: string, parts: readonly string[]): void => {
  const body = parts.filter((part) => part.trim().length > 0).join('; ')
  if (body.length === 0) return
  scopeNote(tag, `${tag} scope — ${body}`)
}
