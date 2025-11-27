/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { validationErrorResponseSchema } from '@/presentation/api/schemas/error-schemas'
import type { Context, TypedResponse } from 'hono'

/**
 * Result type for validation - either success with data or error response
 */
export type ValidationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly response: TypedResponse<unknown> }

/**
 * Format Zod validation errors into API-friendly format
 */
const formatZodErrors = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }))

/**
 * Validate request body against a Zod schema
 *
 * Returns validated data on success, or a formatted error response.
 *
 * @param c - Hono context
 * @param schema - Zod schema to validate against
 * @returns Validation result with data or error response
 *
 * @example
 * ```typescript
 * app.post('/api/records', async (c) => {
 *   const result = await validateRequest(c, createRecordRequestSchema)
 *   if (!result.success) return result.response
 *   // result.data is fully typed and validated
 * })
 * ```
 */
export async function validateRequest<T>(
  c: Context,
  schema: z.ZodType<T>
): Promise<ValidationResult<T>> {
  try {
    const rawBody = await c.req.json()
    const data = schema.parse(rawBody)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse = validationErrorResponseSchema.parse({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: formatZodErrors(error),
      })
      return { success: false, response: c.json(errorResponse, 400) }
    }
    // JSON parse error or unexpected error
    const errorResponse = validationErrorResponseSchema.parse({
      success: false,
      message: 'Invalid JSON body',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'body', message: 'Request body must be valid JSON' }],
    })
    return { success: false, response: c.json(errorResponse, 400) }
  }
}
