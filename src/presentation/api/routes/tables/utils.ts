/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
// eslint-disable-next-line boundaries/element-types -- Route handlers need auth types for session management
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context } from 'hono'

// ============================================================================
// Constants
// ============================================================================

const AUTH_TABLE_MEMBERS = '_sovrium_auth_members'
const AUTH_TABLE_USERS = '_sovrium_auth_users'
const AUTH_KEYWORDS = ['not found', 'access denied'] as const
const DEFAULT_ROLE = 'member'

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

  if (errorMessage.includes('not found')) {
    const recordIdMatch = errorMessage.match(/Record (\S+) not found/)
    return c.json(
      {
        error: 'Record not found',
        recordId: recordIdMatch?.[1] ? Number.parseInt(recordIdMatch[1]) : undefined,
      },
      404
    )
  }

  if (errorMessage.includes('is not deleted')) {
    const recordIdMatch = errorMessage.match(/Record (\S+) is not deleted/)
    return c.json(
      {
        error: 'Bad Request',
        message: 'Record is not deleted',
        recordId: recordIdMatch?.[1] ? Number.parseInt(recordIdMatch[1]) : undefined,
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
 */
export const getSessionFromContext = (c: Context): Readonly<Session> | undefined => {
  return (c as ContextWithSession).var?.session
}

/**
 * Validate table exists and return table name
 * Returns undefined if table not found
 */
export const validateAndGetTableName = (app: App, tableId: string): string | undefined => {
  return getTableNameFromId(app, tableId)
}

/**
 * Retrieves the user's role from the database
 *
 * Role resolution priority:
 * 1. If active organization: check members table for org-specific role
 * 2. If no active organization or no membership: check global user role from users table
 * 3. Default: 'member'
 */
export async function getUserRole(
  userId: string,
  activeOrganizationId?: string | null
): Promise<string> {
  const { db } = await import('@/infrastructure/database')

  // If active organization, check members table first
  if (activeOrganizationId) {
    const memberResult = (await db.execute(
      `SELECT role FROM "${AUTH_TABLE_MEMBERS}" WHERE organization_id = '${activeOrganizationId.replace(/'/g, "''")}' AND user_id = '${userId.replace(/'/g, "''")}' LIMIT 1`
    )) as Array<{ role: string | null }>

    if (memberResult[0]?.role) {
      return memberResult[0].role
    }
  }

  // Fall back to global user role from users table
  const userResult = (await db.execute(
    `SELECT role FROM "${AUTH_TABLE_USERS}" WHERE id = '${userId.replace(/'/g, "''")}' LIMIT 1`
  )) as Array<{ role: string | null }>
  return userResult[0]?.role || DEFAULT_ROLE
}
