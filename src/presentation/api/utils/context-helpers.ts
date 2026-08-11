/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { UserSession } from '@/application/ports/models/user-session'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { ContextWithTableAndRole } from '@/presentation/api/middleware/table'
import type { Context } from 'hono'

/**
 * Extract session from context (optional session)
 *
 * Use for routes with authMiddleware but without requireAuth
 *
 * @param c - Hono context (after authMiddleware)
 * @returns Session if authenticated, undefined otherwise
 */
export function getSessionContext(c: Context): UserSession | undefined {
  return (c as ContextWithSession).var.session
}

/**
 * Build the structured log-attribute record carrying the request correlation id
 * (`request.id`) for a route-level `logError` call, or `undefined` when no id is
 * set (so the attribute is omitted). The id is set by the `hono/request-id`
 * middleware; threading it here lets a route error log be correlated with its
 * access-log line and OTLP trace.
 *
 * @param c - Hono context (request id set by the request-id middleware)
 */
export function requestLogAttributes(c: Context): { readonly 'request.id': string } | undefined {
  const requestId = c.get('requestId')
  return typeof requestId === 'string' && requestId !== '' ? { 'request.id': requestId } : undefined
}

/**
 * Extract table context from request
 *
 * Use for routes with full middleware chain:
 * authMiddleware → requireAuth → validateTable → enrichUserRole
 *
 * **Session is guaranteed to exist** (requireAuth ensures this)
 *
 * @param c - Hono context (after full middleware chain)
 * @returns Object containing session, tableName, tableId, and userRole
 */
export function getTableContext(c: Context): {
  readonly session: UserSession
  readonly tableName: string
  readonly tableId: string
  readonly userRole: string
  readonly userGroups: readonly string[]
} {
  const { var: ctx } = c as ContextWithTableAndRole
  return {
    session: ctx.session,
    tableName: ctx.tableName,
    tableId: ctx.tableId,
    userRole: ctx.userRole,
    // Defensive default: routes registered before enrichUserRole (e.g.
    // /api/tables list) won't have userGroups set.
    userGroups: ctx.userGroups ?? [],
  }
}
