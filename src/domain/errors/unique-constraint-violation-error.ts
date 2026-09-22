/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Unique constraint violation error
 * Thrown when attempting to insert/update a record that violates a unique constraint
 */
export class UniqueConstraintViolationError extends Error {
  readonly _tag = 'UniqueConstraintViolationError'
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'UniqueConstraintViolationError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.cause = cause
  }
}
