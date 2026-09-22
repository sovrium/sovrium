/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import { validationErrorResponseSchema } from '@/domain/models/api/combinators/error'
import type { Context, TypedResponse } from 'hono'

/**
 * Result type for validation - either success with data or error response
 */
export type ValidationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly response: TypedResponse<unknown> }

/**
 * Turn a decode failure into the envelope's field-level entries.
 *
 * Effect renders an issue as `"<reason>\n  at [\"path\",\"to\",\"field\"]"`, so the
 * path is parsed back out of the rendered text rather than walked off the AST —
 * the walk needs a branch per issue tag, and this envelope needs only a name and
 * a sentence. An unparseable path degrades to `body`, never to a dropped error.
 *
 * `code` is gone: Zod's machine-readable issue codes have no Effect counterpart,
 * and `fieldErrorSchema` already declares that field optional.
 */
const formatDecodeErrors = (error: Readonly<Schema.SchemaError>) =>
  error.message
    .split(/\n(?=[^\s])/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const path = /\bat \[(.+?)\]/s.exec(block)
      const field =
        path === null
          ? 'body'
          : (path[1] ?? '')
              .split(',')
              .map((segment) => segment.trim().replace(/^["']|["']$/g, ''))
              .filter((segment) => segment.length > 0)
              .join('.')
      return {
        field: field.length > 0 ? field : 'body',
        message: block
          .replace(/\s*\bat \[.+?\]/s, '')
          .replace(/^SchemaError\(|\)$/g, '')
          .trim(),
      }
    })

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
export async function validateRequest<S extends Schema.Top>(
  c: Context,
  schema: S
): Promise<ValidationResult<S['Type']>> {
  try {
    const rawBody = await c.req.json()
    return { success: true, data: decodeOrThrow(schema)(rawBody) }
  } catch (error) {
    if (Schema.isSchemaError(error)) {
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
      const errorResponse = decodeOrThrow(validationErrorResponseSchema)({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: formatDecodeErrors(error),
      })
      return { success: false, response: c.json(errorResponse, 400) }
    }
    // JSON parse error or unexpected error
    const errorResponse = decodeOrThrow(validationErrorResponseSchema)({
      success: false,
      message: 'Invalid JSON body',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'body', message: 'Request body must be valid JSON' }],
    })
    return { success: false, response: c.json(errorResponse, 400) }
  }
}
