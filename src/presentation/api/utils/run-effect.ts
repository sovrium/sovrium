/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { errorResponseSchema } from '@/presentation/api/schemas/error-schemas'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Schema interface for Zod-compatible parsing
 */
interface ParseableSchema<T> {
  readonly parse: (data: unknown) => T
}

/**
 * Check if error indicates a "not found" or authorization failure
 *
 * Returns true for errors that should result in 404 responses
 * (to prevent enumeration attacks)
 */
function isNotFoundError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error)

  return (
    errorMessage.includes('Record not found') ||
    errorMessage.includes('not found') ||
    errorMessage.includes('access denied')
  )
}

/**
 * Run an Effect program and return a Hono JSON response
 *
 * This utility handles:
 * - Running Effect programs as promises
 * - Validating responses against Zod schemas
 * - Converting errors to standardized error responses
 *
 * @param c - Hono context for response generation
 * @param program - Effect program to execute
 * @param schema - Zod schema for response validation
 * @param successStatus - HTTP status code for successful response (default: 200)
 * @returns JSON response with validated data or error
 *
 * @example
 * ```typescript
 * app.get('/api/users', async (c) =>
 *   runEffect(c, listUsersProgram(), listUsersResponseSchema)
 * )
 * app.post('/api/users', async (c) =>
 *   runEffect(c, createUserProgram(), createUserResponseSchema, 201)
 * )
 * ```
 */
export async function runEffect<T, S>(
  c: Context,
  program: Effect.Effect<T, Error>,
  schema: ParseableSchema<S>,
  successStatus: number = 200
) {
  try {
    const result = await Effect.runPromise(program)
    const validated = schema.parse(result)
    return c.json(validated, successStatus as ContentfulStatusCode)
  } catch (error) {
    // Check if this is a unique constraint violation - return 409
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorName = error instanceof Error ? error.name : ''

    if (
      errorName === 'UniqueConstraintViolationError' ||
      errorMessage.toLowerCase().includes('unique constraint')
    ) {
      return c.json({ error: 'Unique constraint violation' }, 409)
    }

    // Check if this is a SessionContextError indicating "not found" - return 404
    if (isNotFoundError(error)) {
      return c.json({ error: 'Record not found' }, 404)
    }

    // Return generic error for other cases
    const errorDetails = error instanceof Error ? error.message : 'Internal server error'
    const causeDetails =
      error && typeof error === 'object' && 'cause' in error
        ? String(error.cause)
        : 'No cause details'

    return c.json(
      errorResponseSchema.parse({
        success: false,
        message: `${errorDetails} | Cause: ${causeDetails}`,
        code: 'INTERNAL_ERROR',
      }),
      500
    )
  }
}
