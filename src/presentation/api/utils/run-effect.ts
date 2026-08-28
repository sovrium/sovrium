/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
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
  // Request ID for error correlation — set by the `hono/request-id` middleware
  // (mounted first in `createHonoApp`). Falls back to a fresh UUID only if the
  // middleware was not mounted (e.g. an isolated test harness).
  const requestId = (c.get('requestId') as string | undefined) ?? crypto.randomUUID()

  // Sanitize error (removes internal details, logs full error server-side)
  const sanitized = sanitizeError(error, requestId)
  const statusCode = getStatusCode(sanitized.code)

  const errorData = {
    success: false as const,
    error: sanitized.error,
    message: sanitized.message ?? sanitized.error,
    code: sanitized.code,
    ...(sanitized.details ? { details: sanitized.details } : {}),
    // Both keys must also be DECLARED on `errorResponseSchema`: the parse below
    // is a bare object schema, so an undeclared key is stripped silently and
    // the attribution would vanish between here and the wire.
    ...(sanitized.field ? { field: sanitized.field } : {}),
    ...(sanitized.errors ? { errors: sanitized.errors } : {}),
  }

  return c.json(errorResponseSchema.parse(errorData), statusCode)
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
  schema?: ParseableSchema<S>,
  successStatus: number = 200
) {
  try {
    // Use Effect.either to preserve tagged error types (_tag property)
    // Effect.runPromise wraps errors in FiberFailure which strips _tag,
    // preventing error sanitizer from mapping to correct HTTP status codes.
    // Effect.either converts failures to Either.Left, preserving the original error.
    //
    // Run through `runRequestEffect` so the program executes on the observability
    // runtime under the request-edge root `http.server` span: any `Effect.withSpan`
    // seams inside (e.g. the DB access-layer `db.query` span) chain under the
    // request root. `Effect.either` already discharged failures to `Left`, so the
    // program has no requirements and needs no `provideLayer`.
    const either = await runRequestEffect(c, Effect.result(program))

    if (either._tag === 'Failure') {
      return handleErrorResponse(c, either.failure)
    }

    const validated = schema ? schema.parse(either.success) : either.success
    return c.json(validated, successStatus as ContentfulStatusCode)
  } catch (error) {
    // Catches defects (Effect.die), schema validation errors,
    // and other unexpected runtime errors
    return handleErrorResponse(c, error)
  }
}
