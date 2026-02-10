/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export { createTaggedError } from './create-tagged-error'

/**
 * Database session context error
 */
export class SessionContextError extends Error {
  readonly _tag = 'SessionContextError'
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'SessionContextError'
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.cause = cause
  }
}

/**
 * Forbidden error for authorization failures
 */
export class ForbiddenError extends Error {
  readonly _tag = 'ForbiddenError'

  constructor(message: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'ForbiddenError'
  }
}

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

/**
 * Database transaction interface supporting unsafe SQL execution
 */
export interface DatabaseTransaction {
  readonly unsafe: (sql: string) => Promise<unknown>
}
