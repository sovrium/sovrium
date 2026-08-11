/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import type { ContextWithSession } from './auth'
import type { UserSession } from '@/application/ports/models/user-session'
import type { App } from '@/domain/models/app'
import type { Context, Next } from 'hono'

// ============================================================================
// Extended Context Types
// ============================================================================

/**
 * Hono context with validated table information attached
 *
 * Available after `validateTable()` middleware runs.
 * @public
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
 * @public
 */
export type ContextWithUserRole = ContextWithSession & {
  readonly var: {
    readonly userRole: string
    readonly userGroups: readonly string[]
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
    readonly session: UserSession // Non-optional - guaranteed by requireAuth()
    readonly tableName: string
    readonly tableId: string
    readonly userRole: string
    /**
     * Names of the groups the user belongs to (un-prefixed). Used by the
     * permission gates to evaluate `group:<name>` table permissions with
     * most-permissive-wins semantics. Empty array when not group-enabled.
     */
    readonly userGroups: readonly string[]
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
export function validateTable(appOrResolver: App | (() => App)) {
  return async (c: Context, next: Next) => {
    const tableId = c.req.param('tableId')

    if (!tableId) {
      return c.json(
        { success: false, message: 'Table ID parameter required', code: 'VALIDATION_ERROR' },
        400
      )
    }

    // [internal ref]: resolve the live App per-request so a table added by a schema
    // publish (which swaps the live App without a restart) is found here.
    const app = typeof appOrResolver === 'function' ? appOrResolver() : appOrResolver
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
 * Also resolves the user's group memberships (`userGroups`) so the permission
 * gates can evaluate `group:<name>` table permissions with most-permissive-wins
 * semantics.
 *
 * @param getUserRoleFn - Optional function to resolve user role (for unit tests).
 *   Defaults to the real getUserRole from application layer.
 * @param getUserGroupsFn - Optional function to resolve user group names (for
 *   unit tests). Defaults to the real getUserGroups from application layer.
 * @returns Hono middleware function
 */
export function enrichUserRole(
  getUserRoleFn?: (userId: string) => Promise<string>,
  getUserGroupsFn?: (userId: string) => Promise<readonly string[]>
) {
  const resolveRole = getUserRoleFn ?? getUserRole
  const resolveGroups = getUserGroupsFn ?? getUserGroups

  return async (c: Context, next: Next) => {
    const { session } = (c as ContextWithSession).var

    // Defensive check (should not happen if requireAuth() used before)
    if (!session) {
      return c.json(
        { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
        401
      )
    }

    // PG-02 guest-comment exemption: `requireAuthOrGuestComment` stashes a
    // synthetic session with `userId: 'guest'` and already populates
    // `userRole: 'guest'` + `userGroups: []` on the context. Skip the DB
    // lookups so a guest visitor doesn't hit auth tables on every comment
    // submission — and so `resolveRole('guest')` does not fail on a
    // user-not-found.
    if (session.userId === 'guest') {
      // eslint-disable-next-line functional/no-expression-statements -- middleware continuation
      await next()
      return
    }

    const [userRole, userGroups] = await Promise.all([
      resolveRole(session.userId),
      resolveGroups(session.userId),
    ])

    c.set('userRole', userRole)
    c.set('userGroups', userGroups)

    // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue
    await next()
  }
}
