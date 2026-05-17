/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connection-token-repository'
import { notFound, requireSession, unauthorized } from '@/presentation/api/utils/auth-helpers'
import { provideConnectionLive } from './effect-runner'
import { connectionError } from './error-envelopes'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Admin-only listing of users who have completed a real OAuth round-trip
 * for a given connection. Lives in its own module so the parent
 * `connections/index.ts` stays under the 400-line `max-lines` budget.
 *
 * Returns `{ users: Array<{ userId, status, expiresAt }> }` — token
 * plaintext is intentionally omitted because APP-AUTOMATION-
 * CONNECTION-074 explicitly asserts `accessToken`/`refreshToken` MUST
 * NOT appear in the response.
 *
 * Authorization model:
 *   - Unauthenticated → 401
 *   - Connection missing → 404
 *   - Non-admin → 404 (enumeration-prevention pattern Z-3, mirrors
 *     `gateAdminForAppScope` in `connections/index.ts` — a 403 would
 *     leak the existence of the connection to non-admins, so the
 *     response is identical to "connection not found").
 *     Closes REC-C4-3 from the C-4 audit (was previously 403).
 *
 * Response filtering (per APP-AUTOMATION-CONNECTION-093):
 *   - Admin users are excluded from the returned list. Per-user-scope
 *     connections are a member-level concept (admins manage app-scope
 *     connections); an admin's stored token row is therefore an
 *     "auth-only" artifact (e.g. created by the test seeder before
 *     role promotion) and should not appear in the connected-users
 *     roster.
 */
class UsersHandlerError extends Data.TaggedError('UsersHandlerError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

interface ConnectionDef {
  readonly name: string
  readonly type: string
}

const findConnection = (app: App, name: string): ConnectionDef | undefined => {
  const list = (app as { connections?: readonly ConnectionDef[] }).connections ?? []
  return list.find((conn) => conn.name === name)
}

const resolveUserRole = async (userId: string): Promise<string> => {
  const { getUserRole } = await import('@/application/use-cases/tables/user-role')
  return getUserRole(userId)
}

/**
 * Map a token row's `expiresAt` to the same status string the
 * `/status` endpoint emits.
 */
const deriveAdminStatus = (expiresAt: Date | undefined): 'connected' | 'expired' => {
  if (expiresAt !== undefined && expiresAt.getTime() < Date.now()) return 'expired'
  return 'connected'
}

/**
 * Filter out admin users from the connected-users list. Per-user-scope
 * connections are authorized by members on their own behalf; admins
 * manage app-scope connections via the dedicated authorize/disconnect
 * routes, so an admin row in `connection_tokens` for a user-scope
 * connection is by definition an auth-only artifact (typically created
 * by the test seeder before role promotion). Closes
 * APP-AUTOMATION-CONNECTION-093's "admin's auth-only row should NOT
 * appear" assertion.
 *
 * Role lookups run in parallel via Promise.all so the additional
 * round-trip cost scales O(n) wall time once, not O(n) per-row.
 */
const dropAdminUsers = async <T extends { readonly userId: string }>(
  entries: readonly T[]
): Promise<readonly T[]> => {
  const roles = await Promise.all(entries.map((entry) => resolveUserRole(entry.userId)))
  return entries.filter((_, index) => roles[index] !== 'admin')
}

export async function handleListUsers(c: Context, app: App) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const name = c.req.param('name')
  if (name === undefined) return connectionError(c, 400, 'connection_name_required')
  const conn = findConnection(app, name)
  if (conn === undefined) return notFound(c, 'Connection not found')

  // Z-3 enumeration-prevention: non-admin callers receive 404 (same
  // wire shape as "connection doesn't exist") rather than 403, so the
  // endpoint leaks no signal about which admin-only connections exist.
  // Mirrors `gateAdminForAppScope` for `app`-scoped /authorize, /status,
  // /disconnect routes; this listing endpoint is admin-only regardless
  // of the connection's `scope` (per-user roster is sensitive even for
  // user-scope connections — a member should not enumerate peers).
  const role = await resolveUserRole(session.userId)
  if (role !== 'admin') return notFound(c, 'Connection not found')

  // REC-C4-8: only OAuth2 connections have per-user token rows. Returning
  // `{users: []}` for apiKey/basic/bearer is misleading — it looks like
  // "no users have authorized" rather than "this endpoint doesn't apply
  // to this connection type". Mirror the /authorize endpoint's `error`
  // code (`connection_not_oauth2`, 400) and add a `message` field so
  // callers get a clear human-readable signal. The check runs AFTER the
  // admin gate so non-admins still get 404 (no leakage about connection
  // type to non-admins).
  if (conn.type !== 'oauth2') {
    return connectionError(c, 400, 'connection_not_oauth2', {
      message: 'This endpoint applies only to OAuth2 connections.',
    })
  }

  const program = Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const row = yield* connRepo
      .findByName(name)
      .pipe(Effect.mapError((cause) => new UsersHandlerError({ operation: 'findByName', cause })))
    if (row === undefined) return []
    const tokenRepo = yield* ConnectionTokenRepository
    return yield* tokenRepo
      .listUsersForConnection({ connectionId: String(row['id']) })
      .pipe(
        Effect.mapError(
          (cause) => new UsersHandlerError({ operation: 'listUsersForConnection', cause })
        )
      )
  })

  const result = await Effect.runPromise(provideConnectionLive(program).pipe(Effect.either))
  if (result._tag === 'Left') return connectionError(c, 500, 'list_users_failed')
  const memberEntries = await dropAdminUsers(result.right)
  const users = memberEntries.map((entry) => ({
    userId: entry.userId,
    status: deriveAdminStatus(entry.expiresAt),
    // eslint-disable-next-line unicorn/no-null -- contract field; null when no expiry recorded
    expiresAt: entry.expiresAt?.toISOString() ?? null,
  }))
  return c.json({ users }, 200)
}
