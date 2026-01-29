/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Sanitized error codes for client responses
 *
 * These codes are safe to expose to clients and map to standard HTTP status codes.
 */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

/**
 * Sanitized error response for clients
 *
 * This interface ensures that only safe, user-friendly error information
 * is exposed to clients, preventing information disclosure vulnerabilities.
 */
export interface SanitizedError {
  readonly error: string
  readonly code: ErrorCode
  readonly message?: string
}

/**
 * Tagged error types that are safe to expose
 *
 * These errors are explicitly designed to be shown to users and don't
 * contain internal system details.
 */
interface SafeError {
  readonly _tag: string
  readonly message: string
}

/**
 * Check if error is a known safe error type
 *
 * Safe errors are tagged errors with user-friendly messages that don't
 * expose internal system details.
 */
function isSafeError(error: unknown): error is SafeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    'message' in error &&
    typeof (error as { _tag: unknown })._tag === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  )
}

/**
 * Check if error indicates "not found"
 *
 * Detects various patterns that indicate a resource was not found,
 * including access denied cases (which we return as 404 to avoid
 * leaking existence of protected resources).
 */
function isNotFoundError(error: unknown): boolean {
  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return errorMessage.includes('not found') || errorMessage.includes('access denied')
}

/**
 * Sanitize errors for client responses
 *
 * ✅ Removes internal details (file paths, SQL, stack traces, database schemas)
 * ✅ Maps to generic error codes and user-safe messages
 * ✅ Logs full error server-side for debugging
 * ✅ Returns only information safe to expose to clients
 *
 * **Security Benefits:**
 * - Prevents database schema discovery through constraint errors
 * - Hides internal architecture (file paths, service URLs)
 * - Conceals SQL query structure
 * - Protects authorization logic details
 *
 * @param error - The error to sanitize
 * @param requestId - Optional request ID for correlation in logs
 * @returns Sanitized error safe for client consumption
 *
 * @example
 * ```typescript
 * try {
 *   await dangerousOperation()
 * } catch (error) {
 *   const sanitized = sanitizeError(error, requestId)
 *   return c.json(sanitized, getStatusCode(sanitized.code))
 * }
 * ```
 */
export function sanitizeError(error: unknown, requestId?: string): SanitizedError {
  // Log full error for debugging (server-side only, never exposed to client)
  console.error('[API Error]', { requestId, error })

  // Handle known safe error types (Effect.ts tagged errors with user-safe messages)
  if (isSafeError(error)) {
    switch (error._tag) {
      case 'ForbiddenError':
      case 'ForbiddenListTablesError':
        return {
          error: 'Forbidden',
          code: 'FORBIDDEN',
          message: error.message,
        }
      case 'ValidationError':
        return {
          error: 'Validation Error',
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
        }
      case 'UniqueConstraintViolationError':
        return {
          error: 'Conflict',
          code: 'CONFLICT',
          message: 'Resource already exists',
        }
      case 'NotFoundError':
      case 'TableNotFoundError':
        return {
          error: 'Not Found',
          code: 'NOT_FOUND',
          message: 'Resource not found',
        }
    }
  }

  // Check for not-found patterns (includes access denied to avoid leaking existence)
  if (isNotFoundError(error)) {
    return {
      error: 'Not Found',
      code: 'NOT_FOUND',
      message: 'Resource not found',
    }
  }

  // Generic internal error (no details leaked to prevent information disclosure)
  return {
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
  }
}

/**
 * Get HTTP status code for error code
 *
 * Maps sanitized error codes to appropriate HTTP status codes.
 *
 * @param code - The error code
 * @returns HTTP status code
 */
export function getStatusCode(code: ErrorCode): ContentfulStatusCode {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'VALIDATION_ERROR':
      return 400
    case 'CONFLICT':
      return 409
    case 'RATE_LIMITED':
      return 429
    case 'INTERNAL_ERROR':
      return 500
    case 'SERVICE_UNAVAILABLE':
      return 503
  }
}
