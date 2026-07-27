/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  classifyDriverFailure,
  type CallerInputRejectionClass,
  type ConstraintViolationClass,
} from '@/domain/errors/driver-failure'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

export interface SanitizedError {
  readonly error: string
  readonly code: ErrorCode
  readonly message?: string
  readonly details?: readonly string[]
}

export function isNotFoundError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  const name = (error instanceof Error ? error.name : '').toLowerCase()

  return (
    /not found|nosuchkey|enoent|key does not exist|access denied/.test(message) ||
    /nosuchkey|notfound|enoent/.test(name)
  )
}

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

function logErrorDetails(error: unknown, requestId: string | undefined): void {
  logError(`[API Error] requestId=${requestId}`, error)
  logDebug(`[API Error - error type] ${typeof error}`)
  logDebug(
    `[API Error - error own keys] ${error && typeof error === 'object' ? Object.keys(error).join(', ') : 'not an object'}`
  )
  logDebug(
    `[API Error - error all keys] ${error && typeof error === 'object' ? Object.getOwnPropertyNames(error).join(', ') : 'not an object'}`
  )
  const errObj = error as ErrorObject
  logDebug(`[API Error - error _tag] ${errObj._tag}`)
  logDebug(`[API Error - error message] ${errObj.message}`)
  logDebug(`[API Error - error details] ${JSON.stringify(errObj.details)}`)
}

function extractActualError(error: unknown): ErrorObject {
  const errorObj = error as ErrorObject

  if (errorObj && typeof errorObj === 'object' && errorObj.toJSON) {
    try {
      const jsonRep = errorObj.toJSON()
      if (jsonRep?.cause?.failure) {
        const actualError = jsonRep.cause.failure
        logDebug(
          `[API Error - extracted from toJSON cause.failure] _tag=${actualError._tag} message=${actualError.message} details=${JSON.stringify(actualError.details)}`
        )
        return actualError
      }
    } catch (e) {
      logDebug(`[API Error - toJSON extraction failed] ${e}`)
    }
  }

  return errorObj
}

function mapTaggedError(errorTag: string, actualError: ErrorObject): SanitizedError | undefined {
  switch (errorTag) {
    case 'ForbiddenError':
    case 'ActivityLogForbiddenError':
      return {
        error: 'Not Found',
        code: 'NOT_FOUND',
        message: 'Resource not found',
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

const CONSTRAINT_ERROR_CODES = {
  unique: 'CONFLICT',
  check: 'VALIDATION_ERROR',
  'foreign-key': 'INTERNAL_ERROR',
  'not-null': 'INTERNAL_ERROR',
} satisfies Record<ConstraintViolationClass, ErrorCode>

const CONSTRAINT_MESSAGES = {
  unique: 'Resource already exists',
  check: 'A submitted value is not allowed by this resource',
  'foreign-key': 'An unexpected error occurred. Please try again later.',
  'not-null': 'An unexpected error occurred. Please try again later.',
} satisfies Record<ConstraintViolationClass, string>

const CALLER_INPUT_MESSAGES = {
  'undefined-column': 'A submitted field is not recognised for this resource',
  'data-exception': 'A submitted value has an invalid format for its field',
} satisfies Record<CallerInputRejectionClass, string>

const INTERNAL_ERROR: SanitizedError = {
  error: 'Internal Server Error',
  code: 'INTERNAL_ERROR',
  message: 'An unexpected error occurred. Please try again later.',
}

const SANITIZED_ERROR_TITLES = {
  CONFLICT: 'Conflict',
  VALIDATION_ERROR: 'Validation Error',
  INTERNAL_ERROR: 'Internal Server Error',
} satisfies Partial<Record<ErrorCode, string>>

function mapDriverFailure(error: unknown): SanitizedError | undefined {
  const failure = classifyDriverFailure(error)
  switch (failure.origin) {
    case 'constraint': {
      const code = CONSTRAINT_ERROR_CODES[failure.violation]
      return {
        error: SANITIZED_ERROR_TITLES[code],
        code,
        message: CONSTRAINT_MESSAGES[failure.violation],
      }
    }
    case 'caller-input':
      return {
        error: SANITIZED_ERROR_TITLES.VALIDATION_ERROR,
        code: 'VALIDATION_ERROR',
        message: CALLER_INPUT_MESSAGES[failure.rejection],
      }
    case 'operator':
      return INTERNAL_ERROR
    case 'application':
      return undefined
  }
}

export function sanitizeError(error: unknown, requestId?: string): SanitizedError {
  logErrorDetails(error, requestId)

  const actualError = extractActualError(error)
  const errorTag = actualError._tag

  if (errorTag) {
    const sanitized = mapTaggedError(errorTag, actualError)
    if (sanitized) return sanitized
  }

  const driverFailure = mapDriverFailure(error)
  if (driverFailure) return driverFailure

  if (isNotFoundError(error)) {
    return {
      error: 'Not Found',
      code: 'NOT_FOUND',
      message: 'Resource not found',
    }
  }

  return INTERNAL_ERROR
}

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
