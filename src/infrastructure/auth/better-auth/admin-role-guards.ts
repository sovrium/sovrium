/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError } from 'better-auth/api'
import { Effect, Layer } from 'effect'
// eslint-disable-next-line boundaries/dependencies -- Better Auth owns the write to `user.role`, so its `before` hook is the ONLY point where an unassignable role or a last-admin demotion can be rejected before the row changes. Same justification as the trigger-auth-event bridge in `auth.ts`: the guard has to live inside the auth library's lifecycle, and the application-layer use case is the read contract it consults.
import { countActiveAdmins } from '@/application/use-cases/auth/count-admins'
// eslint-disable-next-line boundaries/dependencies -- see countActiveAdmins above: the current role of the mutation target can only be read from inside the Better Auth `before` hook.
import { readUserRoleById } from '@/application/use-cases/auth/get-user-role'
/* eslint-disable boundaries/dependencies -- see countActiveAdmins above: a role change or an impersonation that Better Auth performed can only be observed, and so recorded, from inside its `after` hook. */
import {
  recordImpersonation,
  recordRoleChange,
} from '@/application/use-cases/auth/record-user-acts'
/* eslint-enable boundaries/dependencies */
// eslint-disable-next-line boundaries/dependencies -- see countActiveAdmins above: a demotion that left no admin is put back from the same `after` hook that counted.
import { updateUserRole } from '@/application/use-cases/tables/user-role'
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
import { AuditLogRepositoryLive } from '@/infrastructure/database/repositories/admin/audit-log-repository-live'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import {
  endpointSucceeded,
  readTargetUserId,
  requestKey,
  sessionUserId,
  type AuthMiddlewareCtx,
} from './hook-context'
import type { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
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
  /** Put back the role a refused demotion overwrote. Rejects when it cannot. */
  readonly restoreUserRole?: (userId: string, role: string) => Promise<void>
  readonly recordRoleChange?: (input: RoleChangeRecord) => Promise<void>
  readonly recordImpersonation?: (input: ImpersonationRecord) => Promise<void>
}

/** A role change that stood, as the `after` hook hands it to the audit trail. */
export type RoleChangeRecord = {
  readonly actorId: string
  readonly userId: string
  readonly previousRole: string | null
  readonly role: string
}

/** The start or stop of an impersonation, attributed to the admin. */
export type ImpersonationRecord = {
  readonly phase: 'started' | 'stopped'
  readonly adminId: string
  readonly userId: string
}

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
 * The Effect→Promise bridge for a Better Auth hook's reads and records — the
 * guard reads here, and the act records and rails of the sibling hook modules
 * (`admin-user-act-hooks.ts`, `account-deletion-hooks.ts`), which share it.
 *
 * It lives HERE, and not in the use-cases, because standing rule E1 puts the
 * run at the composition root — and a Better Auth `before` hook is as close to
 * one as this path gets. The hook is a plain `async` callback inside the auth
 * library's own lifecycle: there is no Hono context to read the server's
 * resolved services from, and no surrounding fiber to attach to. So this is the
 * one place that binds the repositories, and `AuthRepositoryLive` and
 * `AuditLogRepositoryLive` (the act records write through the audit funnel) are
 * each a `Layer.succeed` over a constant service object, which makes binding
 * them per call free.
 *
 * Both programs fold their own failure into `undefined` before they arrive, so
 * nothing here can reject.
 */
const AuthHookLayer = Layer.mergeAll(AuthRepositoryLive, AuditLogRepositoryLive)

export const runAuthHookProgram = <A>(
  program: Effect.Effect<A, never, AuthRepository | AuditLogRepository>
): Promise<A> => Effect.runPromise(Effect.provide(program, AuthHookLayer))

/**
 * The bridge for the restoring write. Unlike the reads it CAN reject: a
 * demotion that left no admin and could not be put back must not answer as if
 * it had been, so the failure reaches Better Auth and the request fails.
 */
const runGuardWrite = <E>(program: Effect.Effect<void, E, AuthRepository>): Promise<void> =>
  Effect.runPromise(Effect.provide(program, AuthRepositoryLive))

/** Resolve the injected reads, falling back to the real use cases. */
const roleReader = (deps?: AuthHookDeps) =>
  deps?.getUserRole ?? ((userId: string) => runAuthHookProgram(readUserRoleById(userId)))
const adminCounter = (deps?: AuthHookDeps) =>
  deps?.countActiveAdmins ??
  ((adminRoles: readonly string[]) => runAuthHookProgram(countActiveAdmins(adminRoles)))
const roleRestorer = (deps?: AuthHookDeps) =>
  deps?.restoreUserRole ??
  ((userId: string, role: string) => runGuardWrite(updateUserRole(userId, role)))
const roleChangeRecorder = (deps?: AuthHookDeps) =>
  deps?.recordRoleChange ??
  ((input: RoleChangeRecord) =>
    runAuthHookProgram(
      recordRoleChange({
        author: { kind: 'user', userId: input.actorId },
        userId: input.userId,
        previousRole: input.previousRole,
        role: input.role,
      })
    ))
const impersonationRecorder = (deps?: AuthHookDeps) =>
  deps?.recordImpersonation ??
  ((input: ImpersonationRecord) => runAuthHookProgram(recordImpersonation(input)))

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
  deps?: AuthHookDeps
) {
  const nextRole = readRoleField(ctx, ctx.path)
  // No role in the payload: an update-user that leaves the role alone.
  if (nextRole === undefined || nextRole === null) return

  const userId = readTargetUserId(ctx)
  if (userId === undefined) return

  const previousRole = await roleReader(deps)(userId)
  const demotes = demotesAnAdmin(nextRole, previousRole, app)

  // A failed count skips the guard rather than blocking role management.
  if (demotes && isLastAdmin(await adminCounter(deps)(adminRoleNamesFor(app)))) {
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
  deps?: AuthHookDeps
) {
  const userId = readTargetUserId(ctx)
  if (userId === undefined) return
  const targetRole = await roleReader(deps)(userId)
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
  deps?: AuthHookDeps
) {
  if (ctx.path === '/admin/impersonate-user') {
    await guardImpersonationTarget(ctx, app, deps)
    return
  }
  if (!ROLE_WRITING_PATHS.has(ctx.path)) return
  await validateAssignableRole(ctx, app)
  if (ROLE_DEMOTING_PATHS.has(ctx.path)) {
    await guardLastAdmin(ctx, app, deps)
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
  deps?: AuthHookDeps
) {
  const key = requestKey(ctx)
  const pending = key === undefined ? undefined : pendingRoleWrites.get(key)
  if (pending === undefined) return
  if (!endpointSucceeded(ctx.context.returned)) return

  if (
    pending.demotes &&
    pending.previousRole !== undefined &&
    leavesNoAdmin(await adminCounter(deps)(adminRoleNamesFor(app)))
  ) {
    await roleRestorer(deps)(pending.userId, pending.previousRole)
    throw new APIError('CONFLICT', { message: lastAdminRemovalMessage(app) })
  }

  const change = roleChangeOf(pending.previousRole, pending.nextRole)
  const actorId = sessionUserId(ctx.context.session)
  if (change === undefined || actorId === undefined) return
  await roleChangeRecorder(deps)({ actorId, userId: pending.userId, ...change })
}

/**
 * Record an impersonation that started: the caller is the admin, the body's
 * `userId` the account now being acted as.
 */
async function recordImpersonationStart(ctx: AuthMiddlewareCtx, deps?: AuthHookDeps) {
  if (!endpointSucceeded(ctx.context.returned)) return
  const adminId = sessionUserId(ctx.context.session)
  const userId = readTargetUserId(ctx)
  if (adminId === undefined || userId === undefined) return
  await impersonationRecorder(deps)({ phase: 'started', adminId, userId })
}

/**
 * Record an impersonation that stopped. The request arrives on the
 * impersonation session, which belongs to the account being acted as; the
 * admin is the session's `impersonatedBy`. The entry is attributed to the
 * admin, never to that account.
 */
async function recordImpersonationStop(ctx: AuthMiddlewareCtx, deps?: AuthHookDeps) {
  if (!endpointSucceeded(ctx.context.returned)) return
  const session = ctx.context.session as
    { readonly session?: { readonly impersonatedBy?: unknown } } | null | undefined
  const adminId = session?.session?.impersonatedBy
  const userId = sessionUserId(session)
  if (typeof adminId !== 'string' || adminId === '' || userId === undefined) return
  await impersonationRecorder(deps)({ phase: 'stopped', adminId, userId })
}

/**
 * The `after` half of the admin role guards: settle and record role writes,
 * record impersonations. Runs once Better Auth's handler has returned, so each
 * branch first checks that the endpoint succeeded.
 */
export async function applyAdminRoleAfterHooks(
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  deps?: AuthHookDeps
) {
  if (ROLE_DEMOTING_PATHS.has(ctx.path)) {
    await settleRoleWrite(ctx, app, deps)
    return
  }
  if (ctx.path === '/admin/impersonate-user') {
    await recordImpersonationStart(ctx, deps)
    return
  }
  if (ctx.path === '/admin/stop-impersonating') {
    await recordImpersonationStop(ctx, deps)
  }
}
