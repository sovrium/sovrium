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

export type FieldErrorDetail = {
  readonly field: string
  readonly message: string
}

export class FieldValidationError {
  readonly _tag = 'FieldValidationError'
  constructor(
    readonly message: string,
    readonly field?: string,
    readonly errors?: readonly FieldErrorDetail[]
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
    readonly field?: string,
    readonly errors?: readonly FieldErrorDetail[]
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

export type ValidationError = FieldValidationError | FieldPermissionError | FieldFormatError

export type ValidationResult<T> = Effect.Effect<T, ValidationError, never>

export function createValidationLayer(app: App, tableName: string, userRole: string) {
  return Layer.succeed(ValidationContext, {
    app,
    tableName,
    userRole,
  })
}

type ValidationErrorShape = {
  readonly message: string
  readonly field?: string
  readonly errors?: readonly FieldErrorDetail[]
}

type ValidationErrorEnvelope = {
  readonly status: 400 | 404 | 422
  readonly body: Record<string, unknown>
}

const fieldScopedEnvelope = (
  error: ValidationErrorShape,
  status: 400 | 422
): ValidationErrorEnvelope => {
  const errors =
    error.errors ?? (error.field ? [{ field: error.field, message: error.message }] : [])
  return {
    status,
    body: {
      success: false,
      error: error.message,
      message: error.message,
      code: 'VALIDATION_ERROR',
      ...(error.field ? { field: error.field } : {}),
      ...(errors.length > 0 ? { errors } : {}),
    },
  }
}

const VALIDATION_ERROR_ENVELOPES = {
  FieldFormatError: (error) => fieldScopedEnvelope(error, 422),

  FieldValidationError: (error) => fieldScopedEnvelope(error, 400),

  FieldPermissionError: () => ({
    status: 404,
    body: {
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
  }),
} satisfies Record<
  ValidationError['_tag'],
  (error: ValidationErrorShape) => ValidationErrorEnvelope
>

export function formatValidationError(error: ValidationError, c: HonoContext): Response {
  const { status, body } = VALIDATION_ERROR_ENVELOPES[error._tag](error)
  return c.json(body, status)
}
