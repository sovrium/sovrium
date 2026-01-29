/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getUserRole } from '@/application/use-cases/tables/user-role'
import type { ContextWithSession } from './auth'
import type { App } from '@/domain/models/app'
// eslint-disable-next-line boundaries/element-types -- Type-only imports don't create runtime dependencies (architectural exception)
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { Context, Next } from 'hono'

// ============================================================================
// Extended Context Types
// ============================================================================

/**
 * Hono context with validated table information attached
 *
 * Available after `validateTable()` middleware runs.
 */
export type ContextWithValidatedTable = ContextWithSession & {
  readonly var: {
    readonly tableName: string
    readonly tableId: string
  }
}

/**
 * Hono context with user role attached
 *
 * Available after `enrichUserRole()` middleware runs.
 * Requires session to exist (use after `requireAuth()`).
 */
export type ContextWithUserRole = ContextWithSession & {
  readonly var: {
    readonly userRole: string
  }
}

/**
 * Combined context with session, validated table, and user role
 *
 * Available after full middleware chain:
 * `authMiddleware` → `requireAuth` → `validateTable` → `enrichUserRole`
 *
 * **Session is guaranteed to exist** because `requireAuth()` rejects
 * requests without a valid session.
 */
export type ContextWithTableAndRole = Context & {
  readonly var: {
    readonly session: Session // Non-optional - guaranteed by requireAuth()
    readonly tableName: string
    readonly tableId: string
    readonly userRole: string
  }
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Middleware to validate table exists and resolve table name
 *
 * Extracts :tableId param, validates table exists in app schema,
 * and attaches resolved table name to context.
 *
 * **Context Variables Set**:
 * - `tableName`: The resolved table name
 * - `tableId`: The original tableId parameter
 *
 * **Usage**:
 * ```typescript
 * app.use('/api/tables/:tableId/*', validateTable(app))
 * app.get('/api/tables/:tableId/records', (c: ContextWithValidatedTable) => {
 *   const { tableName } = c.var  // Already validated!
 * })
 * ```
 *
 * @param app - Application configuration containing table definitions
 * @returns Hono middleware function
 */
export function validateTable(app: App) {
  return async (c: Context, next: Next) => {
    const tableId = c.req.param('tableId')

    if (!tableId) {
      return c.json(
        { success: false, message: 'Table ID parameter required', code: 'VALIDATION_ERROR' },
        400
      )
    }

    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    // Attach to context for downstream handlers
    c.set('tableName', table.name)
    c.set('tableId', tableId)

    // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue
    await next()
  }
}

/**
 * Internal middleware handler for enrichUserRole
 */
async function enrichUserRoleHandler(c: Context, next: Next) {
  const { session } = (c as ContextWithSession).var

  // Defensive check (should not happen if requireAuth() used before)
  if (!session) {
    return c.json(
      { success: false, message: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
      401
    )
  }

  const userRole = await getUserRole(session.userId)

  c.set('userRole', userRole)

  // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue
  await next()
}

/**
 * Middleware to enrich context with user role
 *
 * Fetches user role from database and attaches to context.
 * Requires session to exist (use after `requireAuth()` middleware).
 *
 * **Context Variables Set**:
 * - `userRole`: The user's role in the organization
 *
 * **Usage**:
 * ```typescript
 * app.use('/api/tables/*', authMiddleware(auth))
 * app.use('/api/tables/*', requireAuth())
 * app.use('/api/tables/:tableId/*', enrichUserRole())
 * app.get('/api/tables/:tableId/records', (c: ContextWithUserRole) => {
 *   const { userRole } = c.var  // Already fetched!
 * })
 * ```
 *
 * @returns Hono middleware function
 */
export function enrichUserRole() {
  return enrichUserRoleHandler
}
