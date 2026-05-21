/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Layer } from 'effect'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'
import type { Context as HonoContext } from 'hono'

export class FieldValidationError {
  readonly _tag = 'FieldValidationError'
  constructor(
    readonly message: string,
    readonly field?: string
  ) {}
}

export class FieldPermissionError {
  readonly _tag = 'FieldPermissionError'
  constructor(
    readonly message: string,
    readonly field?: string
  ) {}
}

export class FieldFormatError {
  readonly _tag = 'FieldFormatError'
  constructor(
    readonly message: string,
    readonly field?: string
  ) {}
}

export class ValidationContext extends Context.Tag('ValidationContext')<
  ValidationContext,
  {
    readonly app: App
    readonly tableName: string
    readonly userRole: string
  }
>() {}

export type ValidationResult<T> = Effect.Effect<
  T,
  FieldValidationError | FieldPermissionError | FieldFormatError,
  never
>

export function createValidationLayer(app: App, tableName: string, userRole: string) {
  return Layer.succeed(ValidationContext, {
    app,
    tableName,
    userRole,
  })
}

export function formatValidationError(
  error: FieldValidationError | FieldPermissionError | FieldFormatError,
  c: HonoContext
): Response {
  if (error._tag === 'FieldFormatError') {
    return c.json(
      {
        error: error.message,
        ...(error.field ? { field: error.field } : {}),
      },
      422
    )
  }

  if (error._tag === 'FieldValidationError') {
    return c.json(
      {
        success: false,
        error: error.message,
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
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
    404
  )
}
