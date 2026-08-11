/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { validationErrorResponseSchema } from '@/domain/models/api/_shared/error'
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
      // NOTE: this function deliberately never emits 413. It used to special-case
      // a Zod `too_big` on an array whose `maximum >= 1000` and return
      // `{ error: 'PayloadTooLarge' }` — a non-canonical envelope missing the
      // `message` that `errorResponseSchema` requires. That branch was dead:
      // `batchCreateRecordsRequestSchema.records` (`domain/models/api/tables/records.ts`)
      // is the only array in any schema reaching `validateRequest` with a
      // `.max(>= 1000)`, and its route (`handleBatchCreate`) already calls
      // `checkRecordLimitExceeded` at the *identical* 1000 threshold before
      // validation runs. Every other array here caps at 100.
      //
      // Payload-size rejection therefore belongs to the route guards, which
      // return the canonical envelope via `payloadTooLarge()` in `auth-helpers.ts`.
      // If a schema ever gains an array `.max(>= 1000)` WITHOUT a matching route
      // guard, add the guard — do not reintroduce a 413 here.
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
