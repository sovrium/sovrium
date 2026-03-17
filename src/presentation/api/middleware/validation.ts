/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Layer } from 'effect'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'
import type { Context as HonoContext } from 'hono'

/**
 * Validation error types
 */
export class ValidationError {
  readonly _tag = 'ValidationError'
  constructor(
    readonly message: string,
    readonly field?: string
  ) {}
}

export class PermissionError {
  readonly _tag = 'PermissionError'
  constructor(
    readonly message: string,
    readonly field?: string
  ) {}
}

/**
 * Validation context - provides app configuration and request context
 */
export class ValidationContext extends Context.Tag('ValidationContext')<
  ValidationContext,
  {
    readonly app: App
    readonly tableName: string
    readonly userRole: string
  }
>() {}

/**
 * Validation result type
 */
export type ValidationResult<T> = Effect.Effect<T, ValidationError | PermissionError, never>

/**
 * Create a validation layer from app, tableName, and userRole
 */
export function createValidationLayer(app: App, tableName: string, userRole: string) {
  return Layer.succeed(ValidationContext, {
    app,
    tableName,
    userRole,
  })
}

/**
 * Validation error response helper
 */
export function formatValidationError(
  error: ValidationError | PermissionError,
  c: HonoContext
): Response {
  if (error._tag === 'ValidationError') {
    return c.json(
      {
        success: false,
        message: error.message,
        code: 'VALIDATION_ERROR',
        ...(error.field ? { field: error.field } : {}),
      },
      400
    )
  }

  return c.json(
    {
      success: false,
      message: error.message,
      code: 'FORBIDDEN',
      ...(error.field ? { field: error.field } : {}),
    },
    403
  )
}
