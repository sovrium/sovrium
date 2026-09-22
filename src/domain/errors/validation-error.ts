/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Validation error for invalid input data
 * Thrown when input data fails validation before database operations
 */
export class ValidationError extends Error {
  readonly _tag = 'ValidationError'
  readonly details?: readonly {
    readonly record: number
    readonly field: string
    readonly error: string
  }[]

  constructor(
    message: string,
    details?: readonly { readonly record: number; readonly field: string; readonly error: string }[]
  ) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'ValidationError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.details = details
  }
}
