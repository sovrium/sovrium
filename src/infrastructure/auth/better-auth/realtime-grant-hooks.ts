/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  closeSessionConnections,
  closeUserConnections,
} from '@/infrastructure/realtime/connection-counter'
import {
  endpointSucceeded,
  readTargetUserId,
  requestKey,
  sessionUserId,
  type AuthMiddlewareCtx,
} from './hook-context'

/**
 * A live subscription follows its subscriber's CURRENT grant, and lasts no
 * longer than the session it opened with.
 *
 * A subscription resolves the caller's access once, at the handshake; a grant
 * changed after that point would otherwise keep a WebSocket reading rows it no
 * longer may. So every Better Auth endpoint that changes what an account may
 * read — its role, a ban, a group membership or the group itself, its
 * organisation membership, the account itself — closes that
 * account's live connections once it has succeeded. The client reconnects and
 * is judged again at the handshake, the only place a grant is resolved.
 * Closing on any change, not only a narrowing, keeps that one rule.
 *
 * Only a request that stood closes anything: a refused one changed nothing
 * ({@link endpointSucceeded}).
 *
 * A SESSION that ends is followed at a lower level, by
 * {@link closeEndedSessionConnections}: Better Auth's session-delete hook sees
 * every session it deletes — sign-out, a revocation, a ban, an admin-set
 * password, an expired session found and cleaned up — and closes that
 * session's connections with the session-ended code, before the endpoint's own
 * `after` hook runs. When that hook then closes the account's connections for
 * the grant change, the ones already closed are left alone, so a ban reads as
 * a session end, which is what the reconnect would meet.
 *
 * So the endpoints that only END sessions — sign-out, revoking one, several or
 * the other sessions, a password change that revokes the others — are not
 * followed here: they change no grant, and closing every connection of the
 * account would churn the same person's other devices, whose sessions live on.
 */

/**
 * The endpoints whose target account is named `userId` in the request body.
 * `update-user` can set the role too (under `data`).
 */
const TARGET_IN_BODY: ReadonlySet<string> = new Set([
  '/admin/set-role',
  '/admin/update-user',
  '/admin/set-user-password',
  '/admin/ban-user',
  '/admin/remove-user',
  '/organization/add-team-member',
  '/organization/remove-team-member',
])

/**
 * The endpoints that change the caller's own account or organisation
 * membership. Leaving the organisation takes the caller off every group.
 *
 * `/delete-user` is deliberately absent: it mails a confirmation link and
 * changes nothing. The erasure that follows the link closes the account's
 * connections itself (`purgeAccount`), after the rows are gone.
 */
const TARGET_IS_CALLER: ReadonlySet<string> = new Set(['/organization/leave'])

/** Removes a member from the organisation — and so from every group — named by id or email. */
const REMOVE_MEMBER = '/organization/remove-member'

/**
 * The endpoints that change a whole group: removing it (`delete-team` is served
 * by `remove-team`) deletes every membership, and renaming it changes the
 * `group:<name>` role each member carries. Its members are read before the
 * endpoint runs, since a removal takes them with it.
 */
const GROUP_CHANGES: ReadonlySet<string> = new Set([
  '/organization/remove-team',
  '/organization/update-team',
])

/**
 * The accounts a request is about to affect, read by its `before` hook while
 * the rows naming them still exist, keyed by the request's endpoint context so
 * the `after` hook of the same dispatch finds them (see {@link requestKey}).
 */
const affectedBeforeRun = new WeakMap<object, readonly string[]>()

/** Injectable for unit tests (no `mock.module()`). */
export type RealtimeGrantHookDeps = {
  readonly closeUserConnections?: (userId: string) => number
}

/** A non-empty string field of the request body. */
// eslint-disable-next-line functional/prefer-immutable-types
const bodyString = (ctx: AuthMiddlewareCtx, field: string): string | undefined => {
  const value = (ctx.body as Record<string, unknown> | undefined)?.[field]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** One equality condition of a Better Auth adapter query. */
interface WhereEquals {
  readonly field: string
  readonly value: string
}

/** The generic Better Auth adapter's `findOne` / `findMany`, as far as these reads use them. */
interface RowReader {
  readonly findOne: (query: {
    readonly model: string
    readonly where: readonly WhereEquals[]
  }) => Promise<unknown>
  readonly findMany: (query: {
    readonly model: string
    readonly where: readonly WhereEquals[]
  }) => Promise<readonly unknown[]>
}

// eslint-disable-next-line functional/prefer-immutable-types
const rowReader = (ctx: AuthMiddlewareCtx): RowReader =>
  (ctx.context as unknown as { readonly adapter: RowReader }).adapter

/** A non-empty string column of a row read through the adapter. */
const stringColumn = (row: unknown, column: 'id' | 'userId'): string | undefined => {
  const value = (row as Readonly<Record<string, unknown>> | null | undefined)?.[column]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** The account a `remove-member` names, by its email or by its membership id. */
// eslint-disable-next-line functional/prefer-immutable-types
const readRemovedMember = async (ctx: AuthMiddlewareCtx): Promise<readonly string[]> => {
  const named = bodyString(ctx, 'memberIdOrEmail')
  if (named === undefined) return []
  const reader = rowReader(ctx)
  const userId = named.includes('@')
    ? stringColumn(
        await reader.findOne({
          model: 'user',
          where: [{ field: 'email', value: named.toLowerCase() }],
        }),
        'id'
      )
    : stringColumn(
        await reader.findOne({ model: 'member', where: [{ field: 'id', value: named }] }),
        'userId'
      )
  return userId === undefined ? [] : [userId]
}

/** Every member of the group a group-wide change names. */
// eslint-disable-next-line functional/prefer-immutable-types
const readGroupMembers = async (ctx: AuthMiddlewareCtx): Promise<readonly string[]> => {
  const teamId = bodyString(ctx, 'teamId')
  if (teamId === undefined) return []
  const rows = await rowReader(ctx).findMany({
    model: 'teamMember',
    where: [{ field: 'teamId', value: teamId }],
  })
  return [
    ...new Set(
      rows.map((row) => stringColumn(row, 'userId')).filter((id): id is string => id !== undefined)
    ),
  ]
}

/** The read a `before` hook runs for the request, when its after hook will need one. */
const beforeRead = (
  path: string
  // eslint-disable-next-line functional/prefer-immutable-types
): ((ctx: AuthMiddlewareCtx) => Promise<readonly string[]>) | undefined => {
  if (path === REMOVE_MEMBER) return readRemovedMember
  if (GROUP_CHANGES.has(path)) return readGroupMembers
  return undefined
}

/**
 * The `before` half: for a request whose target is gone once it has run — a
 * member removed, a group removed or renamed —
 * remember the accounts it affects while the rows naming them still exist. A
 * read that fails leaves the periodic grant re-check as the bound.
 */
export async function applyRealtimeGrantBeforeHooks(
  // eslint-disable-next-line functional/prefer-immutable-types
  ctx: AuthMiddlewareCtx
): Promise<void> {
  const read = beforeRead(ctx.path)
  const key = requestKey(ctx)
  if (read === undefined || key === undefined) return
  const affected = await read(ctx).catch((): readonly string[] => [])
  // eslint-disable-next-line functional/no-expression-statements -- request-scoped hand-over from the before hook to the after hook of the same dispatch
  if (affected.length > 0) affectedBeforeRun.set(key, affected)
}

/** The accounts whose grant a succeeded request changed, if it is one this module follows. */
// eslint-disable-next-line functional/prefer-immutable-types
const grantChangedFor = (ctx: AuthMiddlewareCtx): readonly string[] => {
  if (TARGET_IN_BODY.has(ctx.path)) {
    const target = readTargetUserId(ctx)
    return target === undefined ? [] : [target]
  }
  if (TARGET_IS_CALLER.has(ctx.path)) {
    const caller = sessionUserId(ctx.context.session)
    return caller === undefined ? [] : [caller]
  }
  const key = requestKey(ctx)
  return key === undefined ? [] : (affectedBeforeRun.get(key) ?? [])
}

/**
 * The `after` half: once a request that changed an account's grant has
 * succeeded, close that account's live realtime connections.
 */
export async function applyRealtimeGrantAfterHooks(
  // eslint-disable-next-line functional/prefer-immutable-types
  ctx: AuthMiddlewareCtx,
  deps?: RealtimeGrantHookDeps
): Promise<void> {
  if (!endpointSucceeded(ctx.context.returned)) return
  const close = deps?.closeUserConnections ?? closeUserConnections
  grantChangedFor(ctx).forEach((userId) => close(userId))
}

/** Injectable for unit tests (no `mock.module()`). */
export type SessionEndHookDeps = {
  readonly closeSessionConnections?: (sessionId: string) => number
}

/**
 * Better Auth's `session.delete.after` database hook: the session is gone, so
 * the connections opened with it close with the session-ended code. The same
 * person's other sessions keep theirs.
 */
export const closeEndedSessionConnections = async (
  session: unknown,
  deps?: SessionEndHookDeps
): Promise<void> => {
  const sessionId = stringColumn(session, 'id')
  if (sessionId === undefined) return
  const close = deps?.closeSessionConnections ?? closeSessionConnections
  // eslint-disable-next-line functional/no-expression-statements -- closing the connections IS the effect of this hook
  close(sessionId)
}
