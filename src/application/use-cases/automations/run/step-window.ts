/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * When a step ran: the wall-clock instants its dispatch started and settled,
 * stamped by the step executor on every top-level step that ran. A step that
 * never ran (`skipped`), a nested step and a step recorded before steps were
 * timed carry neither, and are stored on the run's own window instead.
 */
export interface StepWindowField {
  /** ISO 8601 instant the step's dispatch started. */
  readonly startedAt?: string
  /** ISO 8601 instant the step settled, retries included. */
  readonly completedAt?: string
}

/**
 * The step row's `startedAt` / `completedAt` columns: the step's own window
 * when the executor timed it, else the run's.
 *
 * The run's instants arrive already on the timeline the run is stored on. The
 * step's own instants are the raw clock the executor read, so they are moved
 * onto that same timeline by `toTimeline` (a pinned development host shifts
 * them as it shifts the run, so a step stays inside its run); the identity
 * everywhere else.
 */
export const stepWindowColumns = (
  step: StepWindowField,
  runStartedAt: Readonly<Date>,
  runFinishedAt: Readonly<Date>,
  toTimeline: (at: Readonly<Date>) => Readonly<Date> = (at) => at
): { readonly startedAt: Readonly<Date>; readonly completedAt: Readonly<Date> } =>
  step.startedAt !== undefined && step.completedAt !== undefined
    ? {
        startedAt: toTimeline(new Date(step.startedAt)),
        completedAt: toTimeline(new Date(step.completedAt)),
      }
    : { startedAt: runStartedAt, completedAt: runFinishedAt }
