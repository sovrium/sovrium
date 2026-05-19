/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { sanitizeError, getStatusCode } from './error-sanitizer'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

interface ParseableSchema<T> {
  readonly parse: (data: unknown) => T
}

function handleErrorResponse(c: Context, error: unknown) {
  const requestId = (c.get('requestId') as string | undefined) ?? crypto.randomUUID()

  const sanitized = sanitizeError(error, requestId)
  const statusCode = getStatusCode(sanitized.code)

  const errorData = {
    success: false as const,
    error: sanitized.error,
    message: sanitized.message ?? sanitized.error,
    code: sanitized.code,
    ...(sanitized.details ? { details: sanitized.details } : {}),
  }

  return c.json(errorResponseSchema.parse(errorData), statusCode)
}

export async function runEffect<T, S>(
  c: Context,
  program: Effect.Effect<T, Error>,
  schema?: ParseableSchema<S>,
  successStatus: number = 200
) {
  try {
    const either = await Effect.runPromise(Effect.either(program))

    if (either._tag === 'Left') {
      return handleErrorResponse(c, either.left)
    }

    const validated = schema ? schema.parse(either.right) : either.right
    return c.json(validated, successStatus as ContentfulStatusCode)
  } catch (error) {
    return handleErrorResponse(c, error)
  }
}
