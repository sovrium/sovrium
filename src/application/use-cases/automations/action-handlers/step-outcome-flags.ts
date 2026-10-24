/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Two ways a step reports that it did not act without failing, as fields of
 * `ActionOutcome` (`shared.ts`).
 */

/**
 * A connection whose credential reads from a `$env.` variable that is not set
 * on this instance: an integration the operator has not switched on, not a
 * failure.
 */
export interface UnconfiguredConnection {
  readonly connection: string
  /** The connection's declared label, when it declares one: what the reason names it by. */
  readonly label?: string | undefined
  /** The first unset variable a credential prop references. */
  readonly variable: string
}

/** A step that decided not to act and let the run go on. */
export interface StepSkip {
  /**
   * Set, with `status: 'success'`, when the step decided not to act — a bulk
   * send to a suppressed recipient: the step is recorded `skipped` with this
   * reason in its output, and the run goes on.
   */
  readonly skipped?: string
}
