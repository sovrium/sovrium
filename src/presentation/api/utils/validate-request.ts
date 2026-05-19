/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { validationErrorResponseSchema } from '@/domain/models/api/_shared/error'
import type { Context, TypedResponse } from 'hono'

export type ValidationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly response: TypedResponse<unknown> }

const formatZodErrors = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }))

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
      const hasLargePayloadError = error.issues.some((issue) => {
        if (issue.code !== 'too_big') return false
        if (!('origin' in issue) || (issue as { origin?: string }).origin !== 'array') return false
        if (!('maximum' in issue)) return false
        const { maximum } = issue as { maximum?: number }
        return typeof maximum === 'number' && maximum >= 1000
      })

      if (hasLargePayloadError) {
        return { success: false, response: c.json({ error: 'PayloadTooLarge' }, 413) }
      }

      const errorResponse = validationErrorResponseSchema.parse({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: formatZodErrors(error),
      })
      return { success: false, response: c.json(errorResponse, 400) }
    }
    const errorResponse = validationErrorResponseSchema.parse({
      success: false,
      message: 'Invalid JSON body',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'body', message: 'Request body must be valid JSON' }],
    })
    return { success: false, response: c.json(errorResponse, 400) }
  }
}
