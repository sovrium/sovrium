/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { Context } from 'hono'

/**
 * Shared route error handler
 *
 * Uses centralized error sanitization to prevent information disclosure.
 * Automatically detects not-found/authorization errors and returns appropriate status codes.
 *
 * @param c - Hono context
 * @param error - The error to handle
 * @returns JSON response with sanitized error details
 */
export function handleRouteError(c: Context, error: unknown): Response {
  // Request ID for error correlation — set by the `hono/request-id` middleware
  // (mounted first in `createHonoApp`). Falls back to a fresh UUID only if the
  // middleware was not mounted (e.g. an isolated test harness).
  const requestId = (c.get('requestId') as string | undefined) ?? crypto.randomUUID()
  const sanitized = sanitizeError(error, requestId)
  const statusCode = getStatusCode(sanitized.code)

  return c.json(
    {
      success: false,
      message: sanitized.message,
      code: sanitized.code,
    },
    statusCode
  )
}

/**
 * Handle errors from record restore operations.
 *
 * This used to carry a restore-specific `errorMessage === 'Record is not
 * deleted'` branch, because the producer raised that state as an untyped
 * `DatabaseError` and the exact wording was the only thing that
 * distinguished it from an infrastructure fault.
 *
 * `restoreRecordProgram` now fails with a typed `ValidationError`, which
 * `sanitizeError` already maps to `VALIDATION_ERROR` / 400 while echoing the
 * error's own message — reproducing the previous response byte for byte
 * (`[internal ref]` pins all three of status, `message` and
 * `code`). The special case is therefore redundant, and this handler is now a
 * pass-through kept for call-site clarity at the restore route.
 */
export function handleRestoreRecordError(c: Context, error: unknown): Response {
  return handleRouteError(c, error)
}
