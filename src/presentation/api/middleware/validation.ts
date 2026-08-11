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

/**
 * One entry of the accumulated `errors` array a validation rejection carries.
 *
 * Deliberately the shape of `fieldErrorSchema` (`domain/models/api/_shared/error.ts`)
 * — the `errors` member of `validationErrorResponseSchema`, itself a member of
 * the sanctioned `apiErrorSchema` union that `api/utils/validate-request.ts`
 * already serves in production for Zod body rejections. A client that decodes
 * one decodes the other.
 *
 * NOT `ValidationError.details` (`domain/errors/index.ts`): that array's
 * `record` key is a batch-row ordinal, indexing ACROSS records rather than
 * across the fields of one record. Wrong axis.
 */
export type FieldErrorDetail = {
  readonly field: string
  readonly message: string
}

/**
 * Validation error types
 *
 * `message`/`field` always describe the FIRST offender; `errors` (when present)
 * carries EVERY field the rule refused, in table field-declaration order. The
 * split is what keeps the change additive: the crud-form island reads only
 * `code` + `field` (`handleMutationError` in crud-form-island/submit-pipeline.ts)
 * and keeps rendering exactly one inline message.
 */
export class FieldValidationError {
  readonly _tag = 'FieldValidationError'
  constructor(
    readonly message: string,
    readonly field?: string,
    readonly errors?: readonly FieldErrorDetail[]
  ) {}
}

/**
 * A field-permission denial. Deliberately carries NO accumulated `errors` list:
 * its envelope is a bare 404 that drops even the single field name (S1
 * anti-enumeration), so there is nothing for a list to be rendered into and no
 * constructor to tempt a future caller into supplying one.
 */
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
 * Every error class {@link formatValidationError} must translate into a wire
 * response. Kept as one alias so the union has a single definition to extend —
 * adding a member here is a compile error in `VALIDATION_ERROR_ENVELOPES` until
 * its envelope is declared.
 */
export type ValidationError = FieldValidationError | FieldPermissionError | FieldFormatError

/**
 * Validation result type
 * @public
 */
export type ValidationResult<T> = Effect.Effect<T, ValidationError, never>

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

/** The part of a validation error that shapes its wire envelope. */
type ValidationErrorShape = {
  readonly message: string
  readonly field?: string
  readonly errors?: readonly FieldErrorDetail[]
}

type ValidationErrorEnvelope = {
  readonly status: 400 | 404 | 422
  readonly body: Record<string, unknown>
}

/**
 * The canonical field-scoped validation envelope, shared by the 400 and 422
 * branches because both describe the same thing to a client: one named field
 * carries a value the server refused.
 *
 * `code: 'VALIDATION_ERROR'` + `field` is the contract the crud-form island
 * decodes (`handleMutationError` in crud-form-island/submit-pipeline.ts) to
 * render the message against that field's inline slot. Omit `code` and the
 * island can only fall back to an anonymous form-level banner — the user is
 * told something is wrong without being told what.
 *
 * `error` is retained alongside `message` because existing API specs assert on
 * it; `message` is what the canonical envelope
 * (`errorResponseSchema`) and every client decoder read.
 *
 * `errors` is ADDITIVE and carries every field the rule refused, so a caller
 * fixing its payload learns the full set in one round-trip instead of one
 * offender per request. A rule that accumulated supplies the list; one that
 * refuses a single field gets the equivalent one-entry list derived here, so
 * the wire shape is uniform across the whole seam rather than varying by which
 * rule happened to fail. The key is omitted only when there is no field to name
 * at all ([internal ref]..028).
 */
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

/**
 * TOTAL map from validation-error tag to wire envelope.
 *
 * The `satisfies Record<ValidationError['_tag'], …>` is the point: a fourth
 * error class added to {@link ValidationError} fails to compile here instead of
 * falling through to whatever branch happened to be last. Before this was
 * total, `FieldFormatError` reached the wire without a `code` at all.
 */
const VALIDATION_ERROR_ENVELOPES = {
  /**
   * A well-formed request carrying a value whose SHAPE violates the field's
   * declared format — a `url` field's URL syntax, a slug's character set.
   *
   * 422 is this codebase's established status for that class, not a preference:
   * it is spec-pinned for both producers ([internal ref],
   * [internal ref]) and is what the sibling semantic rejections use
   * (forms.ts, comment-create-handler.ts, organization-team-routes.ts). The
   * error-response contract's "constraint violation → 400" row is scoped to
   * DATABASE failures, a different seam from API-layer format pre-validation.
   */
  FieldFormatError: (error) => fieldScopedEnvelope(error, 422),

  /**
   * The request violates a declared constraint outright — a missing required
   * field, an empty required value, a write to a readonly column.
   */
  FieldValidationError: (error) => fieldScopedEnvelope(error, 400),

  /**
   * S1 anti-enumeration: a field-permission denial returns 404 so the
   * field-permission boundary is not discoverable. The field name is dropped
   * from the envelope for the same reason — naming it would re-disclose exactly
   * what the 404 exists to hide.
   */
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

/**
 * Validation error response helper
 */
export function formatValidationError(error: ValidationError, c: HonoContext): Response {
  const { status, body } = VALIDATION_ERROR_ENVELOPES[error._tag](error)
  return c.json(body, status)
}
