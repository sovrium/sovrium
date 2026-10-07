/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line boundaries/dependencies -- Better Auth owns the write to the ban columns, so whether an account WAS banned before an unban can only be read from inside its `before` hook. Same justification as the role guards in `admin-role-guards.ts`.
import { readUserBannedById } from '@/application/use-cases/auth/read-user-ban-state'
/* eslint-disable boundaries/dependencies -- see readUserBannedById above: a ban, a lifted ban or a password set that Better Auth performed can only be observed, and so recorded, from inside its `after` hook. */
import {
  recordBan,
  recordPasswordSet,
  recordUnban,
} from '@/application/use-cases/auth/record-user-acts'
/* eslint-enable boundaries/dependencies */
import { runAuthHookProgram } from './admin-role-guards'
import {
  endpointSucceeded,
  readTargetUserId,
  requestKey,
  sessionUserId,
  type AuthMiddlewareCtx,
} from './hook-context'

/**
 * What follows the account acts Better Auth performs on its own routes:
 * `POST /admin/ban-user`, `/admin/unban-user` and `/admin/set-user-password`.
 * Each that stood goes on the admin audit trail, and a password an admin set
 * also ends the target's sessions.
 *
 * All of it runs from the `after` hook and only when the endpoint succeeded, so
 * a refused request — a self-ban, an unknown user, a password that is too short
 * or too long — records nothing and ends no session. The actor is the
 * signed-in admin; the account is named by its id alone.
 */

/** A ban that stood, as the `after` hook hands it to the audit trail. */
export type BanRecord = {
  readonly adminId: string
  readonly userId: string
  /** ISO timestamp the ban ends, or `null` for a ban without an end. */
  readonly expiresAt: string | null
}

/** A lifted ban or an admin-set password, attributed to the admin. */
export type AccountActRecord = {
  readonly adminId: string
  readonly userId: string
}

/**
 * Injectable reads and recorders, so unit tests exercise the hooks without a
 * database (and without `mock.module()`). All default to the real use cases.
 */
export type AdminUserActDeps = {
  /** Whether the account is banned now; `undefined` when unreadable. */
  readonly isUserBanned?: (userId: string) => Promise<boolean | undefined>
  readonly recordBan?: (input: BanRecord) => Promise<void>
  readonly recordUnban?: (input: AccountActRecord) => Promise<void>
  readonly recordPasswordSet?: (input: AccountActRecord) => Promise<void>
}

const banReader = (deps?: AdminUserActDeps) =>
  deps?.isUserBanned ?? ((userId: string) => runAuthHookProgram(readUserBannedById(userId)))
const banRecorder = (deps?: AdminUserActDeps) =>
  deps?.recordBan ??
  ((input: BanRecord) =>
    runAuthHookProgram(
      recordBan({
        author: { kind: 'user', userId: input.adminId },
        userId: input.userId,
        expiresAt: input.expiresAt,
      })
    ))
const unbanRecorder = (deps?: AdminUserActDeps) =>
  deps?.recordUnban ??
  ((input: AccountActRecord) =>
    runAuthHookProgram(
      recordUnban({ author: { kind: 'user', userId: input.adminId }, userId: input.userId })
    ))
const passwordSetRecorder = (deps?: AdminUserActDeps) =>
  deps?.recordPasswordSet ??
  ((input: AccountActRecord) => runAuthHookProgram(recordPasswordSet(input)))

/** The Better Auth routes whose successful requests this module follows up. */
const RECORDED_PATHS: ReadonlySet<string> = new Set([
  '/admin/ban-user',
  '/admin/unban-user',
  '/admin/set-user-password',
])

/**
 * Unban requests whose target was banned when the request arrived, keyed by
 * the request's endpoint context (see {@link requestKey}).
 */
const bannedBeforeUnban = new WeakSet<object>()

/**
 * The `before` half: remember whether the account an unban names is banned
 * right now. Lifting a ban nobody had is not a change, and the `after` hook can
 * no longer tell — by then the columns read "not banned" either way.
 */
export async function applyAdminUserActBeforeHooks(
  ctx: AuthMiddlewareCtx,
  deps?: AdminUserActDeps
) {
  if (ctx.path !== '/admin/unban-user') return
  const userId = readTargetUserId(ctx)
  const key = requestKey(ctx)
  if (userId === undefined || key === undefined) return
  if ((await banReader(deps)(userId)) !== true) return
  bannedBeforeUnban.add(key)
}

/**
 * The end of the ban Better Auth just wrote, read from the user it returned:
 * an ISO timestamp, or `null` when the ban has no end.
 */
const returnedBanExpiry = (returned: unknown): string | null => {
  const value = (returned as { readonly user?: { readonly banExpires?: unknown } } | undefined)
    ?.user?.banExpires
  if (value === undefined || value === null) return null
  const date = new Date(value as string | number | Date)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Revoke every session of the user whose password an admin has just set.
 *
 * An admin resets a password for one reason: the old one can no longer be
 * trusted. Leaving the sessions minted under it alive keeps whoever obtained it
 * signed in indefinitely, and the reset that was supposed to lock them out
 * instead only stops them signing in AGAIN. Rotating the credential and
 * rotating what the credential already bought are one action, not two.
 *
 * Unconditional, deliberately. `POST /admin/set-user-password` accepts exactly
 * `{ userId, newPassword }` — its body schema admits nothing else, so a
 * `revokeOtherSessions` flag on the request is parsed away before any handler
 * sees it. Branching on one would produce a condition that is never true and a
 * gap that looks closed. There is also no case for the other branch: an admin
 * who wants to change a password while preserving the sessions is describing
 * the user's own self-service password change, not this endpoint.
 *
 * It uses the same `internalAdapter.deleteUserSessions` that the plugin's own
 * `ban-user`, `revoke-user-sessions` and `remove-user` routes call, so
 * revocation stays one mechanism with one set of semantics rather than a
 * parallel Sovrium-side implementation of session teardown.
 *
 * The caller runs it only for a set that stood: on a 400 or a 404 nothing was
 * rotated, and killing sessions anyway would turn a rejected request into a
 * logout. It does not wait for a readable admin id either — the recording
 * needs one, the revocation does not.
 */
const revokeSessionsAfterPasswordSet = (ctx: AuthMiddlewareCtx, userId: string) =>
  ctx.context.internalAdapter.deleteUserSessions(userId)

/**
 * The `after` half: record a ban, a lifted ban or an admin-set password that
 * stood, and end the sessions of an account whose password an admin set. Runs
 * once Better Auth's handler has returned; nothing happens unless the endpoint
 * succeeded, read through {@link endpointSucceeded} — Better Auth hands a
 * refusal to the after hooks as an `APIError` in `returned`, so "a value came
 * back" is not success.
 */
export async function applyAdminUserActAfterHooks(ctx: AuthMiddlewareCtx, deps?: AdminUserActDeps) {
  const { path } = ctx
  if (!RECORDED_PATHS.has(path)) return
  const { returned, session } = ctx.context
  const userId = readTargetUserId(ctx)
  if (!endpointSucceeded(returned) || userId === undefined) return
  if (path === '/admin/set-user-password') {
    await revokeSessionsAfterPasswordSet(ctx, userId)
  }
  const adminId = sessionUserId(session)
  if (adminId === undefined) return

  if (path === '/admin/ban-user') {
    await banRecorder(deps)({ adminId, userId, expiresAt: returnedBanExpiry(returned) })
    return
  }
  if (path === '/admin/unban-user') {
    const key = requestKey(ctx)
    if (key === undefined || !bannedBeforeUnban.has(key)) return
    await unbanRecorder(deps)({ adminId, userId })
    return
  }
  await passwordSetRecorder(deps)({ adminId, userId })
}
