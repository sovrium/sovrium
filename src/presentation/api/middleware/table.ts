/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isRecordKeyShaped } from '@/domain/models/app/tables/record-id-service'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import type { ContextWithSession } from './auth'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
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

    // Resolve the live App per-request so a table added by a schema
    // publish (which swaps the live App without a restart) is found here.
    const app = typeof appOrResolver === 'function' ? appOrResolver() : appOrResolver
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return notFound(c)
    }

    // Attach to context for downstream handlers
    c.set('tableName', table.name)
    c.set('tableId', tableId)

    await next()
  }
}

/**
 * The fixed words a records path takes where a record id would otherwise sit
 * (`/records/batch`, `/records/upsert`, …) — they route to their own handlers.
 */
const RECORDS_PATH_WORDS: ReadonlySet<string> = new Set([
  'batch',
  'bulk-delete',
  'bulk-update',
  'import',
  'upsert',
])

/**
 * Middleware answering 404 to a record id that cannot be a key of the table.
 *
 * Mounted on the single-record routes after `validateTable`. An id that no key
 * of the table's type could hold — `abc`, `1.5`, an integer past the key's
 * range — names no record, and is answered exactly as a key no record holds,
 * before any query runs: on PostgreSQL the cast would otherwise fail and read
 * as a 400, telling a caller probing ids something about their shape.
 */
export function rejectNonKeyRecordId(appOrResolver: App | (() => App)) {
  return async (c: Context, next: Next) => {
    const recordId = c.req.param('recordId')
    if (recordId === undefined || RECORDS_PATH_WORDS.has(recordId)) {
      await next()
      return undefined
    }
    const app = typeof appOrResolver === 'function' ? appOrResolver() : appOrResolver
    const tableId = c.req.param('tableId')
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)
    if (table !== undefined && !isRecordKeyShaped(recordId, table)) {
      return notFound(c)
    }
    await next()
    return undefined
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
 * THE ROLE IS NORMALISED HERE, ONCE, against the app's role vocabulary: a
 * stored role that is absent, empty or not declared by the app becomes
 * `NO_GRANT_ROLE`, so no evaluator downstream ever sees `''` or an unknown
 * string — both of which would otherwise take the open bare-table default.
 *
 * @param resolveApp - The live app whose role vocabulary judges the stored
 *   role. Omitted, only an absent or empty role is closed.
 * @returns Hono middleware function
 */
export function enrichUserRole(resolveApp?: () => AdminRoleResolvable) {
  return async (c: Context, next: Next) => {
    // Resolved per request, not once at mount: both reads run on the services
    // THIS request carries, so the role and group lookups share its fiber and
    // its span.
    const resolveRole = (userId: string) => runDomainPromise(c, getUserRole(userId, resolveApp?.()))
    const resolveGroups = (userId: string) => runDomainPromise(c, getUserGroups(userId))

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
    // `userRole: SIGNED_OUT_VISITOR_ROLE` + `userGroups: []`. Skip the DB
    // lookups so a guest visitor doesn't hit auth tables on every comment
    // submission — and so `resolveRole('guest')` does not fail on a
    // user-not-found.
    if (session.userId === 'guest') {
      await next()
      return
    }

    const [userRole, userGroups] = await Promise.all([
      resolveRole(session.userId),
      resolveGroups(session.userId),
    ])

    c.set('userRole', userRole)
    c.set('userGroups', userGroups)

    await next()
  }
}
