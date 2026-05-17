/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getUserRole } from '@/application/use-cases/tables/user-role'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, MiddlewareHandler, Next } from 'hono'

/**
 * Three-tier admin RBAC for `/api/admin/*` routes.
 *
 * Per plan §12 Q1 (locked: three tiers from day one):
 *
 * | Role     | Read | Replay (retry/requeue) | Mutations (schema/users/PII reveal) |
 * |----------|:----:|:----------------------:|:-----------------------------------:|
 * | admin    | yes  | yes                    | yes                                 |
 * | operator | yes  | yes                    | no                                  |
 * | auditor  | yes  | no                     | no                                  |
 *
 * `admin` includes everything `operator` and `auditor` can do; `operator`
 * includes everything `auditor` can do. Routes declare the **minimum** allowed
 * role; the middleware computes the hierarchy implicitly.
 *
 * @see plan §12 (locked decisions)
 * @see plan §6.4 (anti-enumeration: 404 for unauthorized)
 */
export type AdminRole = 'admin' | 'operator' | 'auditor'

/**
 * Read-only mapping of role → roles it implies.
 *
 * Exported for callers that need to compose checks outside the middleware
 * (e.g. application-layer business rules that gate by role).
 * @public
 */
export const ADMIN_ROLE_HIERARCHY: Readonly<Record<AdminRole, ReadonlyArray<AdminRole>>> = {
  admin: ['admin', 'operator', 'auditor'],
  operator: ['operator', 'auditor'],
  auditor: ['auditor'],
}

/**
 * Resolved role attached to context after a successful RBAC check.
 *
 * Downstream handlers read this via `getAdminRole(c)` to make role-aware
 * decisions (e.g. an admin reading body-revealed AI prompts vs an operator
 * reading the redacted variant).
 */
export type ContextWithAdminRole = ContextWithSession & {
  readonly var: {
    readonly adminRole?: AdminRole
  }
}

/**
 * Anti-enumeration response: returns 404 with no hint that the route exists.
 *
 * Sovrium's authorization rule (CLAUDE.md → "Anti-enumeration") forbids 401/403
 * for `/api/admin/*` so attackers cannot probe which operator features are
 * available. This helper centralizes the response shape so it stays consistent
 * across every middleware return path.
 */
function notFound(c: Context): Response {
  return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
}

function isAdminRole(value: string): value is AdminRole {
  return value === 'admin' || value === 'operator' || value === 'auditor'
}

/**
 * Compute the set of admin roles that satisfy the `allowed` minimum.
 *
 * Pure function: takes the route's minimum allowed roles, returns every role
 * that should grant access (i.e. the listed roles plus every role that
 * implies them via the hierarchy).
 *
 * @example
 * ```typescript
 * expandAcceptedRoles(['auditor'])  // => ['auditor', 'operator', 'admin']
 * expandAcceptedRoles(['operator']) // => ['operator', 'admin']
 * expandAcceptedRoles(['admin'])    // => ['admin']
 * ```
 */
function expandAcceptedRoles(allowed: ReadonlyArray<AdminRole>): ReadonlyArray<AdminRole> {
  const accepted = allowed.flatMap((role) => {
    if (role === 'auditor') return ['auditor', 'operator', 'admin'] as const
    if (role === 'operator') return ['operator', 'admin'] as const
    return ['admin'] as const
  })
  // Deduplicate while preserving order (irrelevant for correctness, just
  // tidies up the runtime check).
  return Array.from(new Set(accepted))
}

/**
 * Build a Hono middleware that gates an `/api/admin/*` route to the listed roles.
 *
 * **Anti-enumeration contract**: every failure path returns **404**, never 401
 * or 403. The four failure cases are:
 *
 *   1. No session attached (auth middleware did not extract one)
 *   2. Session present but the user has no role record
 *   3. Session present, role record exists, but role is not an admin tier
 *      (e.g. `member`, `viewer`)
 *   4. Session present, role is an admin tier, but the role is not in the
 *      `allowed` list for this route
 *
 * On success, the resolved `AdminRole` is attached to the context as
 * `adminRole` so downstream handlers can branch on it (e.g. admin-only PII
 * reveal). Read it via `getAdminRole(c)`.
 *
 * **Usage**:
 * ```typescript
 * import { requireAdminRole } from '@/presentation/api/middleware/admin-rbac'
 *
 * // Auditor read-only endpoint (admin and operator also accepted)
 * app.get(
 *   '/api/admin/audit-log',
 *   requireAdminRole(['auditor']),
 *   handleListAuditLog
 * )
 *
 * // Operator-or-better replay endpoint
 * app.post(
 *   '/api/admin/automations/runs/:id/retry',
 *   requireAdminRole(['operator']),
 *   handleRetryRun
 * )
 *
 * // Admin-only mutation
 * app.post(
 *   '/api/admin/users/:id/redact-pii',
 *   requireAdminRole(['admin']),
 *   handleRedactPii
 * )
 * ```
 *
 * @param allowed - Minimum role(s) that may access the route. The middleware
 *   accepts every role that implies any listed role via `ADMIN_ROLE_HIERARCHY`.
 *   Pass a single role for the typical "this-or-better" semantic, or pass
 *   multiple roles for an explicit allow-list (rare).
 * @returns Hono middleware that runs the auth + role check and either calls
 *   `next()` or short-circuits with a 404.
 *
 * @see plan §12 Q1 (three tiers locked)
 * @see plan §6.4 (anti-enumeration: 404 over 403)
 */
export function requireAdminRole(allowed: ReadonlyArray<AdminRole>): MiddlewareHandler {
  const accepted = new Set(expandAcceptedRoles(allowed))

  return async (c: Context, next: Next) => {
    const { session } = (c as ContextWithSession).var
    if (!session) {
      return notFound(c)
    }

    const rawRole = await getUserRole(session.userId)
    if (!isAdminRole(rawRole)) {
      return notFound(c)
    }

    if (!accepted.has(rawRole)) {
      return notFound(c)
    }

    // Attach the resolved role for downstream handlers. Hono's `c.set` is
    // typed loosely; readers should use `getAdminRole(c)`.
    c.set('adminRole', rawRole)

    // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue to next handler
    await next()
    return undefined
  }
}

/**
 * Convenience helper used by route handlers to read the resolved admin role.
 *
 * Returns `undefined` if the route was not gated by `requireAdminRole(...)`.
 * Handlers that branch on the role (admin vs operator vs auditor) should
 * destructure this near the top so the read site is unambiguous.
 * @public
 */
export function getAdminRole(c: Context): AdminRole | undefined {
  const value = c.get('adminRole') as unknown
  if (typeof value !== 'string') return undefined
  return isAdminRole(value) ? value : undefined
}
