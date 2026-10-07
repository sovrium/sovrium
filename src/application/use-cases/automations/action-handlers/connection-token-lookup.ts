/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  ConnectionTokenRepository,
  type ConnectionAppTokenPlaintext,
  type ConnectionTokenPlaintext,
} from '@/application/ports/repositories/connections/connection-token-repository'
import { SentinelTokens } from '@/application/ports/services/sentinel-tokens'
import { isEncryptionKeyMismatch } from '@/infrastructure/errors/encryption-key-mismatch-error'
import { buildRefreshProps, resolveClientCredentialsToken } from './client-credentials-token'
import { isExpired, performTokenRefresh } from './connection-token-refresh'
import { isRenewalDue, renewLongLivedToken } from './long-lived-token-renewal'
import { stringProp } from './shared'
import { type ConnectionDef } from './static-auth-header'
import type { RefreshOutcome, TokenServices } from './connection-token-refresh'
import type { Context } from 'effect'

/**
 * Where a connection's access token is read from: the shared app-scoped
 * credential or the acting user's own, refreshed on the way when it has expired.
 */

/**
 * Outcome of reading a user's stored token.
 *
 * `absent` and `unreadable` are kept apart, and collapsing them is the defect
 * this type exists to prevent: they call for opposite
 * operator responses — "this user never connected" versus "every connected
 * user's credentials just became unreadable".
 */
type TokenLookup<T> =
  | { readonly kind: 'found'; readonly token: T }
  | { readonly kind: 'absent' }
  | { readonly kind: 'key-mismatch' }

/**
 * Read the user's stored token, keeping an unreadable row distinguishable from
 * an absent one.
 *
 * Swallowing the read failure into `Effect.void` would collapse both into
 * "no stored token" — the worst available confusion: it points the
 * operator at a user who never connected, while the real cause is that every
 * connected user's credentials just became unreadable.
 *
 * Any OTHER read failure still reports as absent — a database that cannot be
 * reached is not a claim about this user's key.
 */
const lookUpStoredToken = (
  tokenRepo: Context.Service.Shape<typeof ConnectionTokenRepository>,
  connectionId: string,
  userId: string
): Effect.Effect<TokenLookup<ConnectionTokenPlaintext>> =>
  tokenRepo.findForUser({ connectionId, userId }).pipe(
    Effect.map((row): TokenLookup<ConnectionTokenPlaintext> =>
      row === undefined ? { kind: 'absent' } : { kind: 'found', token: row }
    ),
    Effect.catch((error): Effect.Effect<TokenLookup<ConnectionTokenPlaintext>> =>
      Effect.succeed(isEncryptionKeyMismatch(error) ? { kind: 'key-mismatch' } : { kind: 'absent' })
    )
  )

/**
 * Read the connection's SHARED credential, adopting a pre-upgrade user-keyed
 * one if that is all this installation has.
 *
 * The adoption attempt runs only on a miss, and only for `app` scope, so it
 * costs one extra SELECT exactly once per connection per upgrade. It has to
 * live here and not only at boot: a database can reach the pre-upgrade shape
 * at any time (a restore from an older backup, a `scope` flipped from `user`
 * to `app` while the process is running), and an unattended automation that
 * fails in that window is precisely the failure nobody is watching.
 *
 * This is NOT the forbidden cross-scope fallback. It never reads the
 * TRIGGERING user's token — there is no triggering user on these paths. It
 * adopts the connection's own credential, which an older build had nowhere to
 * file but under the operator who clicked Connect.
 */
const lookUpAppToken = (
  tokenRepo: Context.Service.Shape<typeof ConnectionTokenRepository>,
  connectionId: string
): Effect.Effect<TokenLookup<ConnectionAppTokenPlaintext>> =>
  Effect.gen(function* () {
    const first = yield* readAppToken(tokenRepo, connectionId)
    if (first.kind !== 'absent') return first
    const adopted = yield* tokenRepo.adoptLegacyUserTokenAsApp({ connectionId }).pipe(
      // effect-swallow: `false` means "nothing was adopted", which is also what a failed adoption leaves behind — the caller then returns the original lookup, so the failure changes nothing it could have acted on.
      Effect.orElseSucceed(() => false)
    )
    if (!adopted) return first
    return yield* readAppToken(tokenRepo, connectionId)
  })

const readAppToken = (
  tokenRepo: Context.Service.Shape<typeof ConnectionTokenRepository>,
  connectionId: string
): Effect.Effect<TokenLookup<ConnectionAppTokenPlaintext>> =>
  tokenRepo.findForApp({ connectionId }).pipe(
    Effect.map((row): TokenLookup<ConnectionAppTokenPlaintext> =>
      row === undefined ? { kind: 'absent' } : { kind: 'found', token: row }
    ),
    Effect.catch((error): Effect.Effect<TokenLookup<ConnectionAppTokenPlaintext>> =>
      Effect.succeed(isEncryptionKeyMismatch(error) ? { kind: 'key-mismatch' } : { kind: 'absent' })
    )
  )

/**
 * The refusal an `app`-scoped connection gives when it has no shared
 * credential.
 *
 * Deliberately NOT the per-user "no user context" message. That one describes
 * a per-user connection missing its actor and sends whoever reads it hunting
 * for a user who is not the problem; an `app`-scoped connection has exactly
 * one remedy and this names it. The phrase "no token stored" is load-bearing
 * too — a connection spec matches a miss against
 * `/disconnected|not.*authorized|no.*token/i`, and that spec is about a
 * scope-omitted (therefore app-scoped) connection.
 */
const appNotConnectedReason = (conn: ConnectionDef): string =>
  `connection ${conn.name}: not connected — no token stored; ` +
  'an administrator must connect it from the Connections page'

export const resolveAppScopedToken = (
  conn: ConnectionDef,
  connectionId: string
): Effect.Effect<RefreshOutcome, never, TokenServices> =>
  Effect.gen(function* () {
    if (stringProp(conn.props, 'grantType') === 'clientCredentials') {
      return yield* resolveClientCredentialsToken(conn.name, buildRefreshProps(conn), connectionId)
    }
    const tokenRepo = yield* ConnectionTokenRepository
    const lookup = yield* lookUpAppToken(tokenRepo, connectionId)
    if (lookup.kind === 'key-mismatch') {
      return {
        ok: false,
        reason:
          `connection ${conn.name}: the shared token was encrypted with a different encryption key ` +
          '— an administrator must reconnect it',
      } as const
    }
    if (lookup.kind === 'absent') {
      return { ok: false, reason: appNotConnectedReason(conn) } as const
    }
    const { token } = lookup
    const { isSentinelAccessToken } = yield* SentinelTokens
    if (isSentinelAccessToken(token.accessToken)) {
      return { ok: false, reason: appNotConnectedReason(conn) } as const
    }
    if (isExpired(token)) {
      return yield* performTokenRefresh(conn, token, connectionId, { kind: 'app' })
    }
    if (isRenewalDue(conn, token)) {
      return yield* renewLongLivedToken(conn, token, connectionId, { kind: 'app' })
    }
    return { ok: true, token: token.accessToken, fields: token.tokenFields } as const
  }).pipe(
    Effect.withSpan('automations.resolve-app-scoped-token', {
      attributes: { 'connection.name': conn.name },
    })
  )

export const resolveUserScopedToken = (
  conn: ConnectionDef,
  connectionId: string,
  userId: string
): Effect.Effect<RefreshOutcome, never, TokenServices> =>
  Effect.gen(function* () {
    const tokenRepo = yield* ConnectionTokenRepository
    const lookup = yield* lookUpStoredToken(tokenRepo, connectionId, userId)
    if (lookup.kind === 'key-mismatch') {
      return {
        ok: false,
        reason:
          `connection ${conn.name}: the stored token was encrypted with a different encryption key ` +
          '— the user must reconnect',
      } as const
    }
    if (lookup.kind === 'absent') {
      return { ok: false, reason: `connection ${conn.name}: user has no stored token` } as const
    }
    const { token } = lookup
    const { isSentinelAccessToken } = yield* SentinelTokens
    // Test-mode seeder sentinel detection: the seeder upserts a placeholder
    // token at user-create time so encryption-at-rest specs have a row to
    // assert against. The sentinel must never be injected into outbound HTTP
    // requests: a triggering user with no real token gets a "no.*token|not.*authorized|disconnected" error.
    // Without this gate the seeder's 1h-TTL sentinel would silently flow to
    // upstream APIs as a Bearer header, masking the genuine failure mode.
    if (isSentinelAccessToken(token.accessToken)) {
      return {
        ok: false,
        reason: `connection ${conn.name}: user has not authorized (no token)`,
      } as const
    }
    if (isExpired(token)) {
      return yield* performTokenRefresh(conn, token, connectionId, { kind: 'user', userId })
    }
    if (isRenewalDue(conn, token)) {
      return yield* renewLongLivedToken(conn, token, connectionId, { kind: 'user', userId })
    }
    return { ok: true, token: token.accessToken, fields: token.tokenFields } as const
  }).pipe(
    Effect.withSpan('automations.resolve-user-scoped-token', {
      attributes: { 'connection.name': conn.name },
    })
  )
