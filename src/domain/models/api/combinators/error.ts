/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Field validation error schema
 *
 * Represents a validation error on a specific field.
 */
export const fieldErrorSchema = Schema.Struct({
  field: Schema.String.annotate({ description: 'Field name that failed validation' }),
  message: Schema.String.annotate({ description: 'Human-readable error message' }),
  code: optionalField(Schema.String.annotate({ description: 'Machine-readable error code' })),
}).annotate({ identifier: 'FieldError' })

/**
 * Validation error response schema
 *
 * Used for 400 Bad Request responses with field-level errors.
 */
export const validationErrorResponseSchema = Schema.Struct({
  success: Schema.Literal(false).annotate({ description: 'Operation failed' }),
  message: Schema.String.annotate({ description: 'General error message' }),
  code: Schema.Literal('VALIDATION_ERROR').annotate({ description: 'Error type code' }),
  errors: Schema.Array(fieldErrorSchema).annotate({
    description: 'List of field-level validation errors',
  }),
}).annotate({ identifier: 'ValidationErrorResponse' })

/**
 * Generic error response schema
 *
 * Used for non-validation errors (401, 403, 404, 500, etc).
 */
export const errorResponseSchema = Schema.Struct({
  success: Schema.Literal(false).annotate({ description: 'Operation failed' }),
  error: optionalField(Schema.String.annotate({ description: 'Error type identifier' })),
  message: Schema.String.annotate({ description: 'Human-readable error message' }),
  code: Schema.Literals([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'VALIDATION_ERROR',
    'BAD_REQUEST',
    'CONFLICT',
    'PAYLOAD_TOO_LARGE',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    'SERVICE_UNAVAILABLE',
    'STORAGE_ERROR',
    // Admitted 2026-09-03. `buckets.ts` `transformFailureResponse` has emitted
    // this literal on the 500 image-transform-failure path since the silent
    // passthrough was removed, so the union described a contract the runtime
    // had already left. Narrowing the ROUTE instead would have folded a
    // distinguishable failure ("the encoder ran and failed") into the generic
    // STORAGE_ERROR, losing the only signal that separates it from an
    // unreachable object store.
    'TRANSFORM_ERROR',
    'DATABASE_ERROR',
    'QUOTA_EXCEEDED',
    // Admitted 2026-09-11, in one pass, for two distinct reasons.
    //
    // The first six were ALREADY ON THE WIRE and absent from this union, so
    // the published contract described responses the runtime does not send.
    // Each survives the "could the status alone carry this?" test by naming a
    // DIFFERENT repair than its nearest existing member:
    //
    //   AI_PROVIDER_NOT_CONFIGURED — 503, and the operator must set an env var.
    //     SERVICE_UNAVAILABLE says "wait and retry", which is never true here.
    // Already documented as the contract by [internal ref]'s AC table.
    //   TOO_MANY_CONNECTIONS — 429, and the caller must CLOSE a stream.
    //     RATE_LIMITED says "send more slowly", which frees nothing.
    //   NESTED_REPLY_REJECTED — 422; the parent exists but is itself a reply,
    //     which is what lets a client point the reply at the top-level parent
    //     instead of only showing prose.
    //   EMAIL_ALREADY_REGISTERED — 422; the invitee already has an account, so
    //     the repair is "sign in", not "retry the invitation".
    //   INVALID_TOKEN / TOKEN_EXPIRED — 400 and 410 on the route that accepts
    //     an invitation. Expiry is the only one of the two worth asking for a
    //     fresh invitation over, and 410 has no other member here.
    //
    // The last three were MISSING, and their absence was making the code lie.
    // Three call sites carried a comment saying so — a 405 shipped
    // BAD_REQUEST, and 502/504 both shipped SERVICE_UNAVAILABLE — which tells
    // a client the service is down when an upstream is merely slow or broken.
    'AI_PROVIDER_NOT_CONFIGURED',
    'TOO_MANY_CONNECTIONS',
    'NESTED_REPLY_REJECTED',
    'EMAIL_ALREADY_REGISTERED',
    'INVALID_TOKEN',
    'TOKEN_EXPIRED',
    'METHOD_NOT_ALLOWED',
    'BAD_GATEWAY',
    'GATEWAY_TIMEOUT',
  ]).annotate({ description: 'Machine-readable error code' }),
  details: optionalField(
    Schema.Array(Schema.String).annotate({ description: 'Optional error details' })
  ),
  field: optionalField(
    Schema.String.annotate({
      description: 'Submitted field the error is about, when it could be attributed to one',
    })
  ),
  errors: optionalField(
    Schema.Array(fieldErrorSchema).annotate({
      description: 'The same attribution in the accumulating field-error shape',
    })
  ),
}).annotate({ identifier: 'ErrorResponse' })

/**
 * Frozen lookup of every canonical API error code, derived from the schema.
 *
 * Use `ApiErrorCode.FORBIDDEN` instead of the bare `'FORBIDDEN'` literal at
 * call sites to get IDE autocomplete + rename safety. The values are the
 * literal strings the wire format uses; consuming `ApiErrorCode[X]` is
 * type-equivalent to writing the literal directly, so no callsite churn is
 * forced on existing string-literal users.
 */
export const ApiErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  TRANSFORM_ERROR: 'TRANSFORM_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  AI_PROVIDER_NOT_CONFIGURED: 'AI_PROVIDER_NOT_CONFIGURED',
  TOO_MANY_CONNECTIONS: 'TOO_MANY_CONNECTIONS',
  NESTED_REPLY_REJECTED: 'NESTED_REPLY_REJECTED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  BAD_GATEWAY: 'BAD_GATEWAY',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
} as const

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode]

/**
 * Better Auth error response schema
 *
 * Better Auth returns errors in this format.
 */
export const betterAuthErrorSchema = Schema.Struct({
  error: Schema.Struct({
    message: Schema.String.annotate({ description: 'Error message' }),
    status: optionalField(Schema.Finite.annotate({ description: 'HTTP status code' })),
  }).annotate({ description: 'Error details' }),
}).annotate({ identifier: 'BetterAuthError' })

/**
 * Combined API error schema
 *
 * Union of all possible error response formats.
 */
export const apiErrorSchema = Schema.Union([
  validationErrorResponseSchema,
  errorResponseSchema,
  betterAuthErrorSchema,
])

/**
 * TypeScript types inferred from schemas
 */
export type FieldError = typeof fieldErrorSchema.Type
export type ValidationErrorResponse = typeof validationErrorResponseSchema.Type
export type ErrorResponse = typeof errorResponseSchema.Type
export type BetterAuthError = typeof betterAuthErrorSchema.Type
export type ApiError = typeof apiErrorSchema.Type
