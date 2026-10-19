/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The errors a reader who does not read every run is shown in place of the
 * ones the run history keeps: a step that recorded a `clientError` (a
 * hand-started write the database refused for a value another record holds)
 * reads as that, and so does the run's own error when it is that step's.
 * An admin reads the history whole, the write's own failure and the
 * database's reason included.
 */

/** A judged step: its own error and its client error, raw from its row. */
interface ClientErrorStep {
  readonly error?: string | null
  readonly clientError?: string | null
}

/** Each step of `steps` with its client error in place of its own, by position in `judged`. */
export const stepsWithClientErrors = <T extends { readonly error?: string | null }>(
  steps: readonly T[],
  judged: readonly ClientErrorStep[]
): readonly T[] =>
  steps.map((step, index) => {
    const shown = judged[index]?.clientError
    return typeof shown === 'string' ? { ...step, error: shown } : step
  })

/**
 * The run's own error as such a reader reads it: the client error of the step
 * whose error it is, else unchanged.
 */
export const runErrorWithClientError = <B extends { readonly error?: string | null }>(
  body: B,
  judged: readonly ClientErrorStep[]
): B => {
  if (typeof body.error !== 'string') return body
  const shown = judged.find(
    (step) => step.error === body.error && typeof step.clientError === 'string'
  )?.clientError
  return typeof shown === 'string' ? { ...body, error: shown } : body
}
