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
  readonly details?: readonly string[]
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
 * Error object with dynamic properties
 */
interface ErrorObject {
  readonly toJSON?: () => {
    readonly cause?: {
      readonly failure?: {
        readonly _tag?: string
        readonly message?: string
        readonly details?: readonly string[]
      }
    }
  }
  readonly _tag?: string
  readonly message?: string
  readonly details?: readonly string[]
}

/**
 * Log error details for debugging (server-side only)
 */
function logErrorDetails(error: unknown, requestId: string | undefined): void {
  console.error('[API Error]', { requestId, error })
  console.error('[API Error - error type]', typeof error)
  console.error(
    '[API Error - error own keys]',
    error && typeof error === 'object' ? Object.keys(error) : 'not an object'
  )
  console.error(
    '[API Error - error all keys]',
    error && typeof error === 'object' ? Object.getOwnPropertyNames(error) : 'not an object'
  )
  const errObj = error as ErrorObject
  console.error('[API Error - error _tag]', errObj._tag)
  console.error('[API Error - error message]', errObj.message)
  console.error('[API Error - error details]', errObj.details)
}

/**
 * Extract actual error from Effect FiberFailure wrapper
 */
function extractActualError(error: unknown): ErrorObject {
  const errorObj = error as ErrorObject

  // Try to extract the error from FiberFailure via toJSON()
  if (errorObj && typeof errorObj === 'object' && errorObj.toJSON) {
    try {
      const jsonRep = errorObj.toJSON()
      if (jsonRep?.cause?.failure) {
        const actualError = jsonRep.cause.failure
        console.error('[API Error - extracted from toJSON cause.failure]', {
          _tag: actualError._tag,
          message: actualError.message,
          details: actualError.details,
        })
        return actualError
      }
    } catch (e) {
      console.error('[API Error - toJSON extraction failed]', e)
    }
  }

  return errorObj
}

/**
 * Map tagged error to sanitized response
 */
function mapTaggedError(errorTag: string, actualError: ErrorObject): SanitizedError | undefined {
  switch (errorTag) {
    case 'ForbiddenError':
      return {
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: actualError.message,
      }
    case 'ValidationError':
      return {
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        message: actualError.message ?? 'Invalid input data',
        details: actualError.details,
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
    default:
      return undefined
  }
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
  logErrorDetails(error, requestId)

  const actualError = extractActualError(error)
  const errorTag = actualError._tag

  // Handle known safe error types
  if (errorTag) {
    const sanitized = mapTaggedError(errorTag, actualError)
    if (sanitized) return sanitized
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
