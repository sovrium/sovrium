/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { errorResponseSchema } from '@/presentation/api/schemas/error-schemas'
import { sanitizeError, getStatusCode } from './error-sanitizer'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Schema interface for Zod-compatible parsing
 */
interface ParseableSchema<T> {
  readonly parse: (data: unknown) => T
}

/**
 * Handle error response generation
 *
 * Uses centralized error sanitization to prevent information disclosure.
 * Removes internal details (file paths, SQL errors, stack traces) from client responses.
 */
function handleErrorResponse(c: Context, error: unknown) {
  // Generate unique request ID for error correlation
  const requestId = crypto.randomUUID()

  // Sanitize error (removes internal details, logs full error server-side)
  const sanitized = sanitizeError(error, requestId)
  const statusCode = getStatusCode(sanitized.code)

  return c.json(
    errorResponseSchema.parse({
      success: false,
      message: sanitized.message ?? sanitized.error,
      code: sanitized.code,
    }),
    statusCode
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
    return handleErrorResponse(c, error)
  }
}
