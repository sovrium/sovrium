/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export { createTaggedError } from './create-tagged-error'

export class SessionContextError extends Error {
  readonly _tag = 'SessionContextError'
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'SessionContextError'
    this.cause = cause
  }
}

export class ForbiddenError extends Error {
  readonly _tag = 'ForbiddenError'

  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class UniqueConstraintViolationError extends Error {
  readonly _tag = 'UniqueConstraintViolationError'
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'UniqueConstraintViolationError'
    this.cause = cause
  }
}

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
    this.name = 'ValidationError'
    this.details = details
  }
}
