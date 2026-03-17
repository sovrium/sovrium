/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Session } from '@/application/ports/models/user-session'
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
export function getSessionContext(c: Context): Session | undefined {
  return (c as ContextWithSession).var.session
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
  readonly session: Session
  readonly tableName: string
  readonly tableId: string
  readonly userRole: string
} {
  return (c as ContextWithTableAndRole).var
}
