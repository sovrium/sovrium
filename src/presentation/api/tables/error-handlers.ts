/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { conflict } from '@/presentation/api/runtime/auth-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/runtime/error-sanitizer'
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
      // The same four keys `runEffect` answers with, so a missing record reads
      // the same whether this handler or another seam refused it.
      error: sanitized.error,
      message: sanitized.message,
      code: sanitized.code,
      // Carried when the failure could be attributed to one submitted field, so
      // this handler and `runEffect`'s answer the same question the same way —
      // a client should not get a narrower error because of which seam caught it.
      ...(sanitized.field ? { field: sanitized.field } : {}),
      ...(sanitized.errors ? { errors: sanitized.errors } : {}),
    },
    statusCode
  )
}

/**
 * The `409` of a restore that would leave two live records sharing the value of
 * a unique field, or `undefined` for any other failure. The message names the
 * field — a column of the caller's own config — and never the value nor the
 * database's wording (S4); the record stays in the trash.
 */
export function restoreUniqueConflict(c: Context, error: unknown): Response | undefined {
  if (!(error instanceof Error) || error.name !== 'UniqueConstraintViolationError') return undefined
  const { fieldName } = error as { readonly fieldName?: unknown }
  if (typeof fieldName !== 'string' || fieldName.length === 0) return undefined
  return conflict(
    c,
    `Cannot restore: a live record already holds the same value for "${fieldName}". Change one of the two values, then restore.`
  )
}

/**
 * Handle errors from record restore operations.
 *
 * `restoreRecordProgram` fails with a typed `ValidationError` for a record that
 * is not in the trash, which `sanitizeError` maps to `VALIDATION_ERROR` / 400
 * while echoing the error's own message (an API tables records restore spec
 * pins all three of status, `message` and `code`), and with a
 * `UniqueConstraintViolationError` naming the field when the restore would
 * duplicate a unique value — answered by {@link restoreUniqueConflict}.
 */
export function handleRestoreRecordError(c: Context, error: unknown): Response {
  return restoreUniqueConflict(c, error) ?? handleRouteError(c, error)
}
