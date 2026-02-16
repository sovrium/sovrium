/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
// eslint-disable-next-line boundaries/element-types -- Type-only imports don't create runtime dependencies (architectural exception)
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { Context } from 'hono'

// ============================================================================
// Type Re-exports
// ============================================================================

/**
 * Re-export Session type to avoid layer boundary violations in sibling files
 * This is the single point of import from infrastructure in this directory
 */
export type { Session }

// ============================================================================
// Constants
// ============================================================================

const AUTH_KEYWORDS = ['not found', 'access denied'] as const

// ============================================================================
// Table ID Resolution
// ============================================================================

/**
 * Get table name from tableId parameter
 *
 * Looks up the table in the app schema by either:
 * - Table ID (numeric or string match)
 * - Table name (exact match)
 *
 * @param app - Application configuration containing tables
 * @param tableId - Table identifier from route parameter
 * @returns Table name if found, undefined otherwise
 */
export const getTableNameFromId = (app: App, tableId: string): string | undefined => {
  const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)
  return table?.name
}

/**
 * Check if a string contains authorization-related keywords
 */
const containsAuthKeywords = (text: string): boolean =>
  AUTH_KEYWORDS.some((keyword) => text.includes(keyword))

/**
 * Extract error details from an error object
 * Centralizes error information extraction logic
 */
const extractErrorDetails = (
  error: unknown
): { message: string; name: string; causeMessage: string; errorString: string } => {
  const errorMessage = error instanceof Error ? error.message : ''
  const errorName = error instanceof Error ? error.name : ''
  const errorString = String(error)
  const causeMessage =
    error instanceof Error && 'cause' in error && error.cause instanceof Error
      ? error.cause.message
      : ''

  return { message: errorMessage, name: errorName, causeMessage, errorString }
}

/**
 * Check if error is an authorization error (SessionContextError or access denied)
 *
 * @param error - The error to check
 * @returns true if error is authorization-related (should return 404 instead of 500)
 */
export const isAuthorizationError = (error: unknown): boolean => {
  const { message, name, causeMessage, errorString } = extractErrorDetails(error)

  return (
    containsAuthKeywords(message) ||
    containsAuthKeywords(causeMessage) ||
    name.includes('SessionContextError') ||
    errorString.includes('SessionContextError')
  )
}

/**
 * Handle batch restore errors with appropriate HTTP responses
 */
export const handleBatchRestoreError = (c: Context, error: unknown) => {
  // Handle ForbiddenError (viewer role attempting write operation)
  // Use name check to handle multiple import paths resolving to different class instances
  if (error instanceof Error && error.name === 'ForbiddenError') {
    return c.json(
      {
        error: 'Forbidden',
        message: error.message,
      },
      403
    )
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error'

  // Handle "Record X not found" errors (404)
  if (errorMessage.includes('not found')) {
    const recordIdMatch = errorMessage.match(/Record (\S+) not found/)
    const recordId = recordIdMatch?.[1] ? Number.parseInt(recordIdMatch[1]) : undefined
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
        recordId,
      },
      404
    )
  }

  // Handle "Record X is not deleted" errors (400)
  if (errorMessage.includes('is not deleted')) {
    const recordIdMatch = errorMessage.match(/Record (\S+) is not deleted/)
    const recordId = recordIdMatch?.[1] ? Number.parseInt(recordIdMatch[1]) : undefined
    return c.json(
      {
        error: 'Bad Request',
        message: 'Record is not deleted',
        recordId,
      },
      400
    )
  }

  return c.json({ error: 'Internal server error', message: errorMessage }, 500)
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Extract session from Hono context
 * Returns undefined if no session exists
 *
 * @deprecated Use getSessionContext from @/presentation/api/utils/context-helpers instead
 */
export const getSessionFromContext = (c: Context): Readonly<Session> | undefined => {
  return getSessionContext(c)
}

/**
 * Validate table exists and return table name
 * Returns undefined if table not found
 */
export const validateAndGetTableName = (app: App, tableId: string): string | undefined => {
  return getTableNameFromId(app, tableId)
}
