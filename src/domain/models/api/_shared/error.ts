/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

export const fieldErrorSchema = z
  .object({
    field: z.string().describe('Field name that failed validation'),
    message: z.string().describe('Human-readable error message'),
    code: z.string().optional().describe('Machine-readable error code'),
  })
  .openapi('FieldError')

export const validationErrorResponseSchema = z
  .object({
    success: z.literal(false).describe('Operation failed'),
    message: z.string().describe('General error message'),
    code: z.literal('VALIDATION_ERROR').describe('Error type code'),
    errors: z.array(fieldErrorSchema).describe('List of field-level validation errors'),
  })
  .openapi('ValidationErrorResponse')

export const errorResponseSchema = z
  .object({
    success: z.literal(false).describe('Operation failed'),
    error: z.string().optional().describe('Error type identifier'),
    message: z.string().describe('Human-readable error message'),
    code: z
      .enum([
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
        'DATABASE_ERROR',
        'QUOTA_EXCEEDED',
      ])
      .describe('Machine-readable error code'),
    details: z.array(z.string()).optional().describe('Optional error details'),
  })
  .openapi('ErrorResponse')

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
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
} as const

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode]

export const betterAuthErrorSchema = z
  .object({
    error: z
      .object({
        message: z.string().describe('Error message'),
        status: z.number().optional().describe('HTTP status code'),
      })
      .describe('Error details'),
  })
  .openapi('BetterAuthError')

export const apiErrorSchema = z.union([
  validationErrorResponseSchema,
  errorResponseSchema,
  betterAuthErrorSchema,
])

export type FieldError = z.infer<typeof fieldErrorSchema>
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
export type BetterAuthError = z.infer<typeof betterAuthErrorSchema>
export type ApiError = z.infer<typeof apiErrorSchema>
