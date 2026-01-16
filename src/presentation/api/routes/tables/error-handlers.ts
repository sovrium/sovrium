/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

/**
 * Extract error message from unknown error type
 */
export function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Check if error indicates a "not found" or authorization failure
 *
 * Returns true for errors that should result in 404 responses
 * (to prevent enumeration attacks)
 */
export function isNotFoundOrAuthError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorName = error instanceof Error ? error.name : ''
  const errorString = String(error)

  return (
    errorMessage.includes('Record not found') ||
    errorMessage.includes('not found') ||
    errorMessage.includes('access denied') ||
    errorName.includes('SessionContextError') ||
    errorString.includes('SessionContextError')
  )
}

/**
 * Handle errors from record GET operations
 *
 * Returns 404 for not-found/authorization errors, 500 for others
 */
export function handleGetRecordError(c: Context, error: unknown): Response {
  if (isNotFoundOrAuthError(error)) {
    return c.json({ error: 'Record not found' }, 404)
  }

  return c.json(
    {
      error: 'Internal server error',
      message: extractErrorMessage(error),
    },
    500
  )
}

/**
 * Handle errors from record restore operations
 *
 * Handles "Record not found", "Record is not deleted", and other errors
 */
export function handleRestoreRecordError(c: Context, error: unknown): Response {
  const errorMessage = extractErrorMessage(error)

  if (errorMessage === 'Record not found') {
    return c.json({ error: 'Record not found' }, 404)
  }

  if (errorMessage === 'Record is not deleted') {
    return c.json({ error: 'Bad Request', message: 'Record is not deleted' }, 400)
  }

  return c.json(
    {
      error: 'Internal server error',
      message: errorMessage,
    },
    500
  )
}

/**
 * Handle generic internal server errors
 *
 * Returns 500 with error message
 */
export function handleInternalError(c: Context, error: unknown): Response {
  return c.json(
    {
      error: 'Internal server error',
      message: extractErrorMessage(error),
    },
    500
  )
}
