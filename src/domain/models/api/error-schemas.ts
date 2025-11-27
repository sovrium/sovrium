/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

/**
 * Field validation error schema
 *
 * Represents a validation error on a specific field.
 */
export const fieldErrorSchema = z.object({
  field: z.string().describe('Field name that failed validation'),
  message: z.string().describe('Human-readable error message'),
  code: z.string().optional().describe('Machine-readable error code'),
})

/**
 * Validation error response schema
 *
 * Used for 400 Bad Request responses with field-level errors.
 */
export const validationErrorResponseSchema = z.object({
  success: z.literal(false).describe('Operation failed'),
  message: z.string().describe('General error message'),
  code: z.literal('VALIDATION_ERROR').describe('Error type code'),
  errors: z.array(fieldErrorSchema).describe('List of field-level validation errors'),
})

/**
 * Generic error response schema
 *
 * Used for non-validation errors (401, 403, 404, 500, etc).
 */
export const errorResponseSchema = z.object({
  success: z.literal(false).describe('Operation failed'),
  message: z.string().describe('Human-readable error message'),
  code: z
    .enum([
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMITED',
      'INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
    ])
    .describe('Machine-readable error code'),
})

/**
 * Better Auth error response schema
 *
 * Better Auth returns errors in this format.
 */
export const betterAuthErrorSchema = z.object({
  error: z
    .object({
      message: z.string().describe('Error message'),
      status: z.number().optional().describe('HTTP status code'),
    })
    .describe('Error details'),
})

/**
 * Combined API error schema
 *
 * Union of all possible error response formats.
 */
export const apiErrorSchema = z.union([
  validationErrorResponseSchema,
  errorResponseSchema,
  betterAuthErrorSchema,
])

/**
 * TypeScript types inferred from schemas
 */
export type FieldError = z.infer<typeof fieldErrorSchema>
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
export type BetterAuthError = z.infer<typeof betterAuthErrorSchema>
export type ApiError = z.infer<typeof apiErrorSchema>
