/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError } from 'better-auth/api'
// eslint-disable-next-line boundaries/dependencies -- Better Auth owns the write to `user.role`, so its `before` hook is the ONLY point where an unassignable role or a last-admin demotion can be rejected before the row changes. Same justification as the trigger-auth-event bridge in `auth.ts`: the guard has to live inside the auth library's lifecycle, and the application-layer use case is the read contract it consults.
import { countActiveAdmins as countActiveAdminsLive } from '@/application/use-cases/auth/count-admins'
// eslint-disable-next-line boundaries/dependencies -- see countActiveAdmins above: the current role of the mutation target can only be read from inside the Better Auth `before` hook.
import { getUserRoleById as getUserRoleLive } from '@/application/use-cases/auth/get-user-role'
import {
  assignableRoleNames,
  isAdminTier,
  isAssignableRole,
  resolveAdminRole,
} from '@/domain/models/app/auth/roles'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
import type { createAuthMiddleware } from 'better-auth/api'

/**
 * The Better Auth `before`-hook context. Re-derived here (rather than imported
 * from `auth.ts`) so this guard module has no cycle back to the instance
 * factory that consumes it.
 */
type AuthMiddlewareCtx = Parameters<typeof createAuthMiddleware>[0] extends (
  ctx: infer C
) => unknown
  ? C
  : never

/**
 * Admin endpoints whose body can write a `role` onto a user. Every one of them
 * must reject an unassignable role value — Better Auth itself stores whatever
 * string it is handed.
 */
const ROLE_WRITING_PATHS: ReadonlySet<string> = new Set([
  '/admin/set-role',
  '/admin/create-user',
  '/admin/update-user',
])

/**
 * The subset of {@link ROLE_WRITING_PATHS} that can DEMOTE an existing user and
 * therefore reduce the admin population. `/admin/create-user` cannot — it only
 * ever adds a row.
 */
const ROLE_DEMOTING_PATHS: ReadonlySet<string> = new Set(['/admin/set-role', '/admin/update-user'])

/**
 * Injectable reads for the admin role guards. Supplying them lets unit tests
 * exercise the guards without a database and — critically — without
 * `mock.module()`, which contaminates Bun's process-global module cache for
 * every other test file in the run.
 *
 * Both default to the real application-layer use cases.
 */
export type AuthHookDeps = {
  readonly countActiveAdmins?: (adminRoles: readonly string[]) => Promise<number | undefined>
  readonly getUserRole?: (userId: string) => Promise<string | undefined>
}

/**
 * Read the role value out of the request body.
 *
 * `/admin/update-user` nests the mutation under `data`, so the role lives at
 * `body.data.role`, NOT `body.role` — reading the wrong key silently skips
 * validation on that endpoint.
 */
// eslint-disable-next-line functional/prefer-immutable-types
const readRoleField = (ctx: AuthMiddlewareCtx, path: string): unknown => {
  const body = ctx.body as { role?: unknown; data?: { role?: unknown } } | undefined
  return path === '/admin/update-user' ? body?.data?.role : body?.role
}

// eslint-disable-next-line functional/prefer-immutable-types
const readTargetUserId = (ctx: AuthMiddlewareCtx): string | undefined => {
  const body = ctx.body as { userId?: unknown } | undefined
  return typeof body?.userId === 'string' && body.userId !== '' ? body.userId : undefined
}

/**
 * Normalise a role payload into individual role names.
 *
 * Better Auth treats the role column as a comma-separated list: its own
 * `parseRoles` joins an array with `,` and `hasPermission` splits on `,`. So
 * `'member,superadmin'`, `['member', 'superadmin']` and
 * `['member,superadmin']` are all the same thing downstream — every SEGMENT
 * must be validated, or a smuggled value rides in on a legitimate one.
 */
const roleSegments = (raw: unknown): readonly string[] =>
  (Array.isArray(raw) ? raw : [raw])
    .filter((value): value is string => typeof value === 'string')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '')

/**
 * The role names that can actually reach `/api/auth/admin/*` for this app: the
 * app's resolved admin-equivalent role plus the literal `'admin'` when they
 * differ (mirroring `isAdminEquivalent`'s dual clause).
 *
 * Deliberately NOT `isAdminTier`: an `admin-viewer` / `operator` is 404ed by
 * `applyAdminRoleCheckMiddleware`, so counting it as an admin would leave the
 * door locked while the guard reported it open.
 */
const adminRoleNamesFor = (app: AdminRoleResolvable): readonly string[] => {
  const resolved = resolveAdminRole(app)
  return resolved === 'admin' ? [resolved] : [resolved, 'admin']
}

/**
 * `true` when a raw stored role value grants at least one of `names`. Absent /
 * unknown roles are `false`, so a caller cannot mistake "could not read the
 * role" for "holds the role".
 */
const grantsAnyOf = (role: string | undefined, names: readonly string[]): boolean =>
  role !== undefined && roleSegments(role).some((segment) => names.includes(segment))

/** Resolve the injected reads, falling back to the real use cases. */
const roleReader = (deps?: AuthHookDeps) => deps?.getUserRole ?? getUserRoleLive
const adminCounter = (deps?: AuthHookDeps) => deps?.countActiveAdmins ?? countActiveAdminsLive

/**
 * Reject a role value the app does not know about, with a 400.
 *
 * Runs BEFORE Better Auth's handler, therefore before its `findUserById`: a
 * request carrying both a bad role and a non-existent `userId` now answers 400
 * rather than 404. That ordering is intentional — the payload is malformed
 * regardless of which user it names.
 *
 * The message lists the valid roles. The caller is an already-verified admin
 * (`applyAdminRoleCheckMiddleware` has 404ed everyone else), so this discloses
 * nothing they cannot read from `/admin/list-users`, and it makes the rejection
 * self-explanatory instead of a bare 400.
 */
// eslint-disable-next-line functional/prefer-immutable-types
async function validateAssignableRole(ctx: AuthMiddlewareCtx, app: AdminRoleResolvable) {
  const segments = roleSegments(readRoleField(ctx, ctx.path))
  // No role in the payload — nothing to validate. Better Auth still enforces
  // its own required-field rules (a bare `{}` on set-role stays a 400).
  if (segments.length === 0) return
  const invalid = segments.find((segment) => !isAssignableRole(segment, app))
  if (invalid === undefined) return
  const valid = [...assignableRoleNames(app)].toSorted().join(', ')
  // eslint-disable-next-line functional/no-throw-statements
  throw new APIError('BAD_REQUEST', {
    message: `Role '${invalid}' is not assignable. Valid roles: ${valid}.`,
  })
}

/**
 * Refuse a role mutation that would remove the last admin who can still sign
 * in, with a 409.
 *
 * The guard fires only when ALL of the following hold, so a routine demotion of
 * a non-admin never trips it:
 *  1. the new role contains no admin-capable name (otherwise it is not a
 *     demotion at all), and
 *  2. the target CURRENTLY holds an admin-capable role, and
 *  3. exactly one non-banned admin remains.
 *
 * KNOWN RACE — stated rather than engineered around. Two concurrent demotions
 * of the last two admins can both read a count of 2 and both proceed. Closing
 * it needs a serializable transaction spanning the count and the update, which
 * a Better Auth `before` hook cannot obtain (Better Auth owns the write), and a
 * database `CHECK` is unavailable because released migrations are frozen. Both
 * actors here are already admins, so this is a foot-gun rail between trusted
 * operators — NOT a security boundary. Treat it as such.
 */
async function guardLastAdmin(
  // eslint-disable-next-line functional/prefer-immutable-types
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  deps?: AuthHookDeps
) {
  const adminRoles = adminRoleNamesFor(app)
  const nextSegments = roleSegments(readRoleField(ctx, ctx.path))
  if (nextSegments.length === 0) return
  if (nextSegments.some((segment) => adminRoles.includes(segment))) return

  const userId = readTargetUserId(ctx)
  if (userId === undefined) return

  const currentRole = await roleReader(deps)(userId)
  // Not currently an admin → demoting it cannot reduce the admin population.
  if (!grantsAnyOf(currentRole, adminRoles)) return

  const remaining = await adminCounter(deps)(adminRoles)
  // A failed count skips the guard rather than blocking role management.
  if (remaining === undefined || remaining > 1) return

  // eslint-disable-next-line functional/no-throw-statements
  throw new APIError('CONFLICT', {
    message: `Cannot remove the last remaining admin. Promote another user to '${resolveAdminRole(app)}' first.`,
  })
}

/**
 * Refuse to impersonate an admin-tier target, with a 403 carrying Better
 * Auth's own wording.
 *
 * Better Auth already blocks impersonation of a target holding one of its
 * configured `adminRoles` — which Sovrium pins to `['admin']`, because widening
 * it throws at plugin construction unless every name is also declared in a
 * `roles` map (vendored `admin.ts:54-69`), and passing `roles` REPLACES the
 * default permission set. So the dashboard-tier roles (`operator`,
 * `admin-editor`, `admin-viewer`, an app's resolved top custom role) are
 * privileged yet freely impersonable upstream. This closes that gap.
 *
 * The message is verbatim `ADMIN_ERROR_CODES.YOU_CANNOT_IMPERSONATE_ADMINS`, so
 * the Sovrium path and the upstream path are indistinguishable to a client.
 *
 * MAINTENANCE: Sovrium now owns a guard Better Auth also owns for the literal
 * `admin`. The two can drift on upgrade — see the Better Auth entry in
 * `[internal ref]`.
 */
async function guardImpersonationTarget(
  // eslint-disable-next-line functional/prefer-immutable-types
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  deps?: AuthHookDeps
) {
  const userId = readTargetUserId(ctx)
  if (userId === undefined) return
  const targetRole = await roleReader(deps)(userId)
  if (targetRole === undefined) return
  if (!roleSegments(targetRole).some((segment) => isAdminTier(segment, app))) return
  // eslint-disable-next-line functional/no-throw-statements
  throw new APIError('FORBIDDEN', { message: 'You cannot impersonate admins' })
}

/**
 * Dispatch the admin role guards for the current request path.
 *
 * ORDER MATTERS: the assignability check (400) runs before the lockout check
 * (409), so a request that is both malformed and destructive reports the
 * malformation.
 */
export async function applyAdminRoleGuards(
  // eslint-disable-next-line functional/prefer-immutable-types
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  deps?: AuthHookDeps
) {
  if (ctx.path === '/admin/impersonate-user') {
    // eslint-disable-next-line functional/no-expression-statements
    await guardImpersonationTarget(ctx, app, deps)
    return
  }
  if (!ROLE_WRITING_PATHS.has(ctx.path)) return
  // eslint-disable-next-line functional/no-expression-statements
  await validateAssignableRole(ctx, app)
  if (ROLE_DEMOTING_PATHS.has(ctx.path)) {
    // eslint-disable-next-line functional/no-expression-statements
    await guardLastAdmin(ctx, app, deps)
  }
}
