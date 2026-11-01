/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError } from 'better-auth/api'
import { isAdminTier } from '@/domain/models/app/auth/roles'
import {
  adminRoleNamesFor,
  demotesAnAdmin,
  findUnassignableRoleSegment,
  isLastAdmin,
  lastAdminRemovalMessage,
  leavesNoAdmin,
  roleChangeOf,
  roleSegments,
  unassignableRoleMessage,
} from '@/domain/models/app/auth/roles/role-write-validation'
import {
  endpointSucceeded,
  readTargetUserId,
  requestKey,
  sessionUserId,
  type AuthMiddlewareCtx,
} from './hook-context'
import type { AuthHookPolicies } from '@/application/ports/contracts/auth-hook-policies'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'

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
 * The reads, records and restoring write the admin role guards consult — the
 * application's decisions, built by the server and handed in
 * (`AuthHookPolicies`). Tests hand a record of their own, which keeps them off
 * the database and off `mock.module()`.
 */
export type AdminRoleGuardPolicies = Pick<
  AuthHookPolicies,
  | 'countActiveAdmins'
  | 'readUserRole'
  | 'writeUserRole'
  | 'recordRoleChange'
  | 'recordImpersonation'
>

/**
 * What the `before` hook learned about a role write, kept for the `after` hook
 * of the SAME request: the target, the role it held, the payload, and whether
 * the write demotes an admin.
 */
type PendingRoleWrite = {
  readonly userId: string
  readonly previousRole: string | undefined
  readonly nextRole: unknown
  readonly demotes: boolean
}

/**
 * Pending role writes, keyed by the request's endpoint context object (see
 * {@link requestKey}). A WeakMap, so each entry goes with its request —
 * including one the after hook never reads, for a request a later before hook
 * refused.
 */
const pendingRoleWrites = new WeakMap<object, PendingRoleWrite>()

/**
 * Read the role value out of the request body.
 *
 * `/admin/update-user` nests the mutation under `data`, so the role lives at
 * `body.data.role`, NOT `body.role` — reading the wrong key silently skips
 * validation on that endpoint.
 */
const readRoleField = (ctx: AuthMiddlewareCtx, path: string): unknown => {
  const body = ctx.body as { role?: unknown; data?: { role?: unknown } } | undefined
  return path === '/admin/update-user' ? body?.data?.role : body?.role
}

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
async function validateAssignableRole(ctx: AuthMiddlewareCtx, app: AdminRoleResolvable) {
  // No role in the payload — nothing to validate. Better Auth still enforces
  // its own required-field rules (a bare `{}` on set-role stays a 400). Any
  // role that IS present must be one exact assignable name: Better Auth stores
  // it verbatim (an array joined with `,`), and Sovrium reads it whole.
  const invalid = findUnassignableRoleSegment(readRoleField(ctx, ctx.path), app)
  if (invalid === undefined) return
  throw new APIError('BAD_REQUEST', { message: unassignableRoleMessage(invalid, app) })
}

/**
 * Refuse a role mutation that would remove the last admin who can still sign
 * in, with a 409 — and remember the write for the `after` hook.
 *
 * The refusal fires only when ALL of the following hold, so a routine demotion
 * of a non-admin never trips it:
 *  1. the new role contains no admin-capable name (otherwise it is not a
 *     demotion at all), and
 *  2. the target CURRENTLY holds an admin-capable role, and
 *  3. exactly one non-banned admin remains.
 *
 * This is the fast, write-free refusal for the ordinary case. It cannot see two
 * demotions sent together — both read a count of 2 — so the `after` hook counts
 * again once the write has committed ({@link settleRoleWrite}). Every write
 * that names a role is remembered, demoting or not, because the `after` hook is
 * also where a change that stood is put on the audit trail.
 */
async function guardLastAdmin(
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  policies: AdminRoleGuardPolicies
) {
  const nextRole = readRoleField(ctx, ctx.path)
  // No role in the payload: an update-user that leaves the role alone.
  if (nextRole === undefined || nextRole === null) return

  const userId = readTargetUserId(ctx)
  if (userId === undefined) return

  const previousRole = await policies.readUserRole(userId)
  const demotes = demotesAnAdmin(nextRole, previousRole, app)

  // A failed count skips the guard rather than blocking role management.
  if (demotes && isLastAdmin(await policies.countActiveAdmins(adminRoleNamesFor(app)))) {
    throw new APIError('CONFLICT', { message: lastAdminRemovalMessage(app) })
  }

  const key = requestKey(ctx)
  if (key === undefined) return
  pendingRoleWrites.set(key, { userId, previousRole, nextRole, demotes })
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
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  policies: AdminRoleGuardPolicies
) {
  const userId = readTargetUserId(ctx)
  if (userId === undefined) return
  const targetRole = await policies.readUserRole(userId)
  if (targetRole === undefined) return
  if (!roleSegments(targetRole).some((segment) => isAdminTier(segment, app))) return
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
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  policies: AdminRoleGuardPolicies
) {
  if (ctx.path === '/admin/impersonate-user') {
    await guardImpersonationTarget(ctx, app, policies)
    return
  }
  if (!ROLE_WRITING_PATHS.has(ctx.path)) return
  await validateAssignableRole(ctx, app)
  if (ROLE_DEMOTING_PATHS.has(ctx.path)) {
    await guardLastAdmin(ctx, app, policies)
  }
}

/**
 * Settle a role write Better Auth has just made: undo it if it left no admin,
 * record it if it stood.
 *
 * The count is taken again AFTER the write. Two demotions of the last two
 * admins sent together both pass the before-write check, but each write commits
 * before its own recount, so at least one recount runs after both writes and
 * finds no admin: that request puts its target's previous role back and is
 * refused with the rail's 409. Both may do so — both requests then answer 409
 * and both admins keep their role, which errs towards the rail's purpose.
 *
 * Only a write that stood reaches the trail, and only when it changed the role:
 * setting the role an account already holds is not a role change. The actor is
 * the signed-in caller — Better Auth's admin middleware has put that session on
 * the context by the time the endpoint ran.
 */
async function settleRoleWrite(
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  policies: AdminRoleGuardPolicies
) {
  const key = requestKey(ctx)
  const pending = key === undefined ? undefined : pendingRoleWrites.get(key)
  if (pending === undefined) return
  if (!endpointSucceeded(ctx.context.returned)) return

  if (
    pending.demotes &&
    pending.previousRole !== undefined &&
    leavesNoAdmin(await policies.countActiveAdmins(adminRoleNamesFor(app)))
  ) {
    await policies.writeUserRole(pending.userId, pending.previousRole)
    throw new APIError('CONFLICT', { message: lastAdminRemovalMessage(app) })
  }

  const change = roleChangeOf(pending.previousRole, pending.nextRole)
  const actorId = sessionUserId(ctx.context.session)
  if (change === undefined || actorId === undefined) return
  await policies.recordRoleChange({ actorId, userId: pending.userId, ...change })
}

/**
 * Record an impersonation that started: the caller is the admin, the body's
 * `userId` the account now being acted as.
 */
async function recordImpersonationStart(ctx: AuthMiddlewareCtx, policies: AdminRoleGuardPolicies) {
  if (!endpointSucceeded(ctx.context.returned)) return
  const adminId = sessionUserId(ctx.context.session)
  const userId = readTargetUserId(ctx)
  if (adminId === undefined || userId === undefined) return
  await policies.recordImpersonation({ phase: 'started', adminId, userId })
}

/**
 * Record an impersonation that stopped. The request arrives on the
 * impersonation session, which belongs to the account being acted as; the
 * admin is the session's `impersonatedBy`. The entry is attributed to the
 * admin, never to that account.
 */
async function recordImpersonationStop(ctx: AuthMiddlewareCtx, policies: AdminRoleGuardPolicies) {
  if (!endpointSucceeded(ctx.context.returned)) return
  const session = ctx.context.session as
    { readonly session?: { readonly impersonatedBy?: unknown } } | null | undefined
  const adminId = session?.session?.impersonatedBy
  const userId = sessionUserId(session)
  if (typeof adminId !== 'string' || adminId === '' || userId === undefined) return
  await policies.recordImpersonation({ phase: 'stopped', adminId, userId })
}

/**
 * The `after` half of the admin role guards: settle and record role writes,
 * record impersonations. Runs once Better Auth's handler has returned, so each
 * branch first checks that the endpoint succeeded.
 */
export async function applyAdminRoleAfterHooks(
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  policies: AdminRoleGuardPolicies
) {
  if (ROLE_DEMOTING_PATHS.has(ctx.path)) {
    await settleRoleWrite(ctx, app, policies)
    return
  }
  if (ctx.path === '/admin/impersonate-user') {
    await recordImpersonationStart(ctx, policies)
    return
  }
  if (ctx.path === '/admin/stop-impersonating') {
    await recordImpersonationStop(ctx, policies)
  }
}
