/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { Context } from 'hono'

/**
 * Handle errors from record GET operations
 *
 * Uses centralized error sanitization to prevent information disclosure.
 * Automatically detects not-found/authorization errors and returns appropriate status codes.
 */
export function handleGetRecordError(c: Context, error: unknown): Response {
  const requestId = crypto.randomUUID()
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
 * Handle errors from record restore operations
 *
 * Uses centralized error sanitization with special handling for restore-specific errors.
 */
export function handleRestoreRecordError(c: Context, error: unknown): Response {
  const requestId = crypto.randomUUID()

  // Check for "Record is not deleted" error (safe to expose)
  const errorMessage = error instanceof Error ? error.message : String(error)
  if (errorMessage === 'Record is not deleted') {
    return c.json(
      { success: false, message: 'Record is not deleted', code: 'VALIDATION_ERROR' },
      400
    )
  }

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
 * Handle generic internal server errors
 *
 * Uses centralized error sanitization to prevent information disclosure.
 */
export function handleInternalError(c: Context, error: unknown): Response {
  const requestId = crypto.randomUUID()
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
