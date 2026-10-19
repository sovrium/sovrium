/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The error a reader who does not read every run is shown in place of the one
 * the run history keeps. A hand-started write the database refused because
 * another record holds the value reads as any other refused write
 * (`Resource not found`), whether or not its starter may read that record; an
 * admin reading the run keeps the write's own failure and the database's
 * reason. A step records it (`step-record.ts`), the run carries it while its
 * own error is still that step's, and every road a non-admin reads a run by
 * shows it instead.
 */

/** A step's or a run's error as such a reader is shown it, when that differs. */
export interface ClientErrorField {
  readonly clientError?: string
}

/** The run error such a reader is shown, keyed by the run error it stands for. */
export interface RunClientErrorField {
  readonly runClientError?: { readonly error: string; readonly shown: string }
}

/**
 * The run's client error after a step: this step's when it set the run error,
 * the one already held while the run error is unchanged, else none.
 */
export const runClientErrorAfterStep = (
  held: RunClientErrorField & { readonly runError: string | undefined },
  runError: string | undefined,
  shown: string | undefined
): RunClientErrorField => {
  if (runError === held.runError) {
    return held.runClientError === undefined ? {} : { runClientError: held.runClientError }
  }
  return runError === undefined || shown === undefined
    ? {}
    : { runClientError: { error: runError, shown } }
}

/** The client error of a finished run: only while its error is still the one it stands for. */
export const runResultClientError = (
  final: RunClientErrorField & { readonly runError: string | undefined }
): ClientErrorField =>
  final.runClientError !== undefined && final.runClientError.error === final.runError
    ? { clientError: final.runClientError.shown }
    : {}
