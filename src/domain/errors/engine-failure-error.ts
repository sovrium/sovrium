/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A failure Sovrium has no specific handling for, met while starting or
 * building — the opposite of a `ConfigRejectedError`.
 *
 * Its `message` is the headline a person reads (`Sovrium failed to build: …`).
 * The value that actually failed travels beside it as `failure`, NOT as the
 * standard `cause`: the logger renders a cause chain on every failed build,
 * and a failed query's chain can carry its bound values. The CLI reads
 * `failure` for what only the original knows — its class and its stack, which
 * name the bug report it offers.
 *
 * `name` stays `Error` so the printed stack reads as it always did.
 */
export class EngineFailureError extends Error {
  /** The value the start or the build failed with, untouched. */
  readonly failure: unknown

  constructor(message: string, failure: unknown) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.failure = failure
  }
}

/** Narrow a caught value to an engine failure. Pure. */
export const isEngineFailureError = (error: unknown): error is EngineFailureError =>
  error instanceof EngineFailureError
