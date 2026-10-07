/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import {
  OAuthTokenClient,
  type OAuth2RefreshProps,
} from '@/application/ports/services/oauth-token-client'
import { logError } from '@/infrastructure/logging/logger'
import { buildRefreshProps } from './client-credentials-token'
import { stringProp } from './shared'
import { type ConnectionDef } from './static-auth-header'
import type { AutomationContext } from './shared'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { SentinelTokens } from '@/application/ports/services/sentinel-tokens'

/**
 * The refresh of a stored OAuth2 connection token: when a token counts as
 * expired, the call to the provider's token endpoint, and what is kept, retried
 * or deleted when it answers.
 */

/**
 * What a token refresh reaches: the encrypted store, the provider's token
 * endpoint, and the detector for the test seeder's placeholder credential.
 */
export type TokenServices = ConnectionTokenRepository | OAuthTokenClient | SentinelTokens
export type ConnectionServices = ConnectionRepository | TokenServices

/**
 * Tagged error for the inner refresh-fetch promise. Wrapping the
 * unknown rejection from `fetch`/`AbortController` in a Data.TaggedError
 * keeps the Effect error channel discriminable (effect/unknownInEffectCatch).
 */
class RefreshTransportError extends Data.TaggedError('RefreshTransportError')<{
  readonly cause: unknown
}> {}

/**
 * Predicate: does this token need refreshing? `expiresAt === undefined`
 * means the provider didn't give an expiry (some non-OIDC OAuth2 flows
 * issue long-lived tokens) — treat as fresh. Add a small skew so a
 * token expiring in the next second isn't injected only to fail at the
 * upstream API.
 */
const REFRESH_SKEW_MS = 5000

/**
 * The fields the refresh machinery reads from a stored token, common to the
 * per-user row and the shared `app`-scoped row. Both plaintext shapes satisfy
 * it; the shared one simply has no `userId` to satisfy.
 */
interface StoredToken {
  readonly accessToken: string
  readonly refreshToken: string | undefined
  readonly expiresAt: Date | undefined
  readonly tokenFields?: Readonly<Record<string, string>> | undefined
}

/**
 * WHICH credential store a resolution is operating on.
 *
 * Modelled explicitly rather than as `userId: string | undefined` so no code
 * path can drift into treating "we happen to have no user" as "use the shared
 * credential". Those are different claims: the first is a fact about the
 * trigger, the second is a decision about the connection's declared `scope`,
 * and conflating them is precisely how a member's personal token ends up
 * acting as the company.
 */
type TokenScope = { readonly kind: 'user'; readonly userId: string } | { readonly kind: 'app' }

/** The lock key's user segment — `undefined` for the shared credential. */
const scopeUserId = (scope: TokenScope): string | undefined =>
  scope.kind === 'user' ? scope.userId : undefined

/**
 * The connection's declared scope. Mirrors `effectiveScope` in
 * `presentation/api/routes/connections/index.ts` — the default is `app`, and
 * the two MUST agree: that route decides who may authorize a connection, this
 * one decides which store the resulting credential is read back from. A
 * disagreement would let an operator authorize into one store while every
 * automation reads the other.
 */
export const connectionScope = (conn: ConnectionDef, automation: AutomationContext): TokenScope => {
  const declared = (conn.props as { scope?: unknown }).scope
  // A client-credentials token belongs to the client, never to a user.
  if (declared === 'user' && stringProp(conn.props, 'grantType') !== 'clientCredentials') {
    return { kind: 'user', userId: automation.userId ?? '' }
  }
  return { kind: 'app' }
}

export const isExpired = (token: StoredToken): boolean => {
  if (token.expiresAt === undefined) return false
  return token.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS
}

/**
 * Wrap the upstream refresh call in an Effect, surfacing transport
 * failures as a typed error. The actual single-flight dedup is now
 * applied at the `performTokenRefresh` level so the locked unit
 * spans refresh AND persist — see comments there for the rationale
 * (closes the persist/findForUser race window).
 */
const callRefreshEndpoint = (
  refreshProps: OAuth2RefreshProps,
  refreshToken: string
): Effect.Effect<
  | {
      readonly ok: true
      readonly accessToken: string
      readonly refreshToken: string | undefined
      readonly expiresAt: Date | undefined
      readonly fields?: Readonly<Record<string, string>> | undefined
    }
  | { readonly ok: false; readonly error: string },
  never,
  OAuthTokenClient
> =>
  OAuthTokenClient.use((tokens) => tokens.refreshAccessToken(refreshProps, refreshToken)).pipe(
    Effect.mapError((error) => new RefreshTransportError({ cause: error.cause })),
    Effect.catchTag('RefreshTransportError', (err) =>
      Effect.succeed({
        ok: false as const,
        error: err.cause instanceof Error ? err.cause.message : 'refresh_request_failed',
      })
    )
  )

/**
 * Persist new tokens through the encrypted upsert path. The
 * (connection_id, user_id) unique-index conflict resolution makes
 * the write atomic against any concurrent writers.
 *
 * Persistence failure handling: if the encrypted write fails we
 * surface a refresh failure rather than returning the freshly
 * issued accessToken. Most providers invalidate the previous
 * refresh_token the moment they issue a new one, so a successful
 * upstream exchange that we fail to persist would burn the
 * refresh chain — the next cycle would re-use the now-invalid
 * stored refresh_token and the connection would deadlock.
 * Failing this cycle keeps the option to re-authorize open.
 */
const persistRefreshedTokens = (input: {
  readonly connectionId: string
  readonly scope: TokenScope
  readonly accessToken: string
  readonly refreshToken: string | undefined
  readonly expiresAt: Date | undefined
  readonly tokenFields: Readonly<Record<string, string>> | undefined
}): Effect.Effect<{ readonly ok: true } | { readonly ok: false }, never, TokenServices> =>
  Effect.gen(function* () {
    const tokenRepo = yield* ConnectionTokenRepository
    const common = {
      connectionId: input.connectionId,
      accessToken: input.accessToken,
      ...(input.refreshToken !== undefined ? { refreshToken: input.refreshToken } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      ...(input.tokenFields !== undefined ? { tokenFields: input.tokenFields } : {}),
    }
    const write =
      input.scope.kind === 'user'
        ? Effect.asVoid(tokenRepo.upsertForUser({ ...common, userId: input.scope.userId }))
        : Effect.asVoid(tokenRepo.upsertForApp(common))
    return yield* write.pipe(
      Effect.map(() => ({ ok: true }) as const),
      // effect-swallow: the failure is not lost, it is RETURNED — `{ ok: false }` is the caller's branch for "the token was not stored", and it is checked. This converts a channel, it does not discard one.
      Effect.orElseSucceed(() => ({ ok: false }) as const)
    )
  })

/**
 * A resolved OAuth2 credential: the access token, plus the kept token-response
 * fields (`tokenFields`) a `$token.FIELD` base URL reads — or the refusal.
 */
export type RefreshOutcome =
  | {
      readonly ok: true
      readonly token: string
      readonly fields?: Readonly<Record<string, string>> | undefined
    }
  | { readonly ok: false; readonly reason: string }

const refreshFailure = (conn: ConnectionDef, suffix: string): RefreshOutcome =>
  ({ ok: false, reason: `connection ${conn.name}: ${suffix}` }) as const

/**
 * Determine whether a refresh-failure error tag indicates a permanent
 * 4xx rejection (revoked or expired refresh token) vs a transient 5xx
 * provider failure or a network/timeout.
 *
 * 4xx rejections are terminal — RFC 6749 §5.2 mandates the provider
 * returns 400 Bad Request with `error: invalid_grant` for revoked or
 * expired refresh tokens, and the spec is explicit that the token will
 * never become valid again. Keeping the row would let stale state
 * silently break the connection forever; delete-on-4xx forces the
 * user to re-authorize.
 *
 * 5xx and transport failures are transient — the next attempt may
 * succeed, so the row must survive.
 *
 * The error format is set in `token-refresh.ts`:
 *   `refresh_endpoint_4xx_<statusCode>` (4xx rejection)
 *   `refresh_endpoint_5xx_<statusCode>` (5xx upstream failure)
 *   `refresh_response_missing_access_token` (malformed 200 response)
 *   `refresh_request_failed` / network error message (transport)
 */
const isPermanentRefreshFailure = (errorTag: string): boolean =>
  errorTag.startsWith('refresh_endpoint_4xx')

/**
 * Delete the stored token row for `(connectionId, userId)`. Invoked
 * after a 4xx refresh failure so subsequent `/status` calls report
 * `disconnected` and the user is forced to re-authorize. Errors are
 * swallowed — failing to delete after a refresh failure should not
 * mask the underlying refresh failure to the caller.
 */
const deleteStoredToken = (
  connectionId: string,
  scope: TokenScope
): Effect.Effect<void, never, TokenServices> =>
  Effect.gen(function* () {
    const tokenRepo = yield* ConnectionTokenRepository
    const drop =
      scope.kind === 'user'
        ? tokenRepo.deleteForUser({ connectionId, userId: scope.userId })
        : tokenRepo.deleteForApp({ connectionId })
    yield* drop.pipe(
      // A token that could not be deleted stays usable. Non-fatal — the caller is
      // already on a failure path — but an operator revoking access needs to know
      // the revocation did not land.
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[connections] stale token not deleted', cause))
      ),
      Effect.catch(() => Effect.void)
    )
  })

/**
 * Run the refresh-token exchange and persist the new tokens through the
 * encrypted upsert path. Wrapped in `withRefreshLock` so concurrent
 * automations sharing a connection coalesce into a single upstream
 * refresh.
 *
 * Returns the new accessToken on success, or a tagged error string on
 * failure (provider rejection, missing refresh_token, missing client
 * config, persistence failure). Failures here translate to action
 * failures upstream — the caller surfaces the reason in the action's
 * error log.
 *
 * Failure handling:
 *   - 4xx (permanent): the refresh token is revoked/invalid and will
 *     never work again. Delete the stored token row so `/status`
 *     reports `disconnected` and the user re-authorizes
 *.
 *   - 5xx (transient) or network error: keep the row; the next
 *     attempt may succeed.
 */
/**
 * Inner refresh+persist sequence — the unit that runs INSIDE
 * `withRefreshLock`'s single-flight dedup. The full
 * "look up refresh props, hit the provider, persist new tokens,
 * handle 4xx/5xx differently" lifecycle is bundled here so concurrent
 * triggers for the same (connectionId, userId) coalesce into one
 * locked execution and observe the same final outcome — including
 * the post-persist DB state.
 *
 * Bundling persist into the lock closes a race window: locking only the
 * upstream HTTP call would let caller B's `findForUser` could observe
 * the still-expired pre-refresh token between A's response landing
 * and A's `upsertForUser` completing — triggering a redundant second
 * refresh.
 */
const refreshAndPersistInner = (
  conn: ConnectionDef,
  token: StoredToken,
  connectionId: string,
  scope: TokenScope
): Effect.Effect<RefreshOutcome, never, TokenServices> =>
  Effect.gen(function* () {
    if (token.refreshToken === undefined || token.refreshToken === '') {
      return refreshFailure(
        conn,
        'reconnect needed — the token expired and the provider issued no refresh token, so authorize the connection again'
      )
    }
    const refreshProps = buildRefreshProps(conn)
    if (refreshProps === undefined) {
      return refreshFailure(conn, 'missing client config for refresh')
    }
    const result = yield* callRefreshEndpoint(refreshProps, token.refreshToken)
    if (!result.ok) {
      // Permanent 4xx → delete the row before surfacing the failure
      // so subsequent automations see "no token" rather than re-trying
      // the same dead refresh_token forever. Transient 5xx and network
      // failures leave the row intact so a follow-up attempt can recover.
      if (isPermanentRefreshFailure(result.error)) {
        yield* deleteStoredToken(connectionId, scope)
      }
      return refreshFailure(conn, `refresh failed (${result.error})`)
    }
    const persisted = yield* persistRefreshedTokens({
      connectionId,
      scope,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      tokenFields: result.fields,
    })
    if (!persisted.ok) {
      return refreshFailure(conn, 'refresh succeeded but token persistence failed')
    }
    return { ok: true, token: result.accessToken, fields: result.fields } as const
  })

/**
 * Single-flight refresh+persist for `(connectionId, userId)`. Wraps
 * `refreshAndPersistInner` with `withRefreshLock` so concurrent
 * automations sharing the same connection AND triggering user
 * coalesce into one upstream `/token` POST AND one `upsertForUser` —
 * the second arrival awaits the same Promise and reads the same
 * `RefreshOutcome` rather than re-fetching the token from the DB
 * (which would expose the persist/findForUser race).
 *
 * The lock is a Promise-shaped primitive, so crossing into Promise
 * land is inherent to it. `withRefreshLockEffect` owns that crossing
 * (it lives beside the lock in token-refresh.ts) and runs the inner
 * program on the services THIS fiber already holds, so the token
 * repository is the automation runtime's rather than a fresh one per
 * arrival.
 */
export const performTokenRefresh = (
  conn: ConnectionDef,
  token: StoredToken,
  connectionId: string,
  scope: TokenScope
): Effect.Effect<RefreshOutcome, never, TokenServices> =>
  OAuthTokenClient.use((tokens) =>
    tokens.withRefreshLock(
      { connectionId, userId: scopeUserId(scope) },
      refreshAndPersistInner(conn, token, connectionId, scope),
      (cause) => new RefreshTransportError({ cause })
    )
  ).pipe(
    Effect.catchTag('RefreshTransportError', (err) =>
      Effect.succeed(
        refreshFailure(
          conn,
          err.cause instanceof Error ? err.cause.message : 'refresh_request_failed'
        )
      )
    ),
    Effect.withSpan('automations.refresh-connection-token', {
      attributes: { 'connection.name': conn.name, 'connection.scope': scope.kind },
    })
  )

/**
 * OAuth2 token lookup: find the system.connections row by name, then
 * load the user's stored token row. Both queries scope the result to
 * the current automation's user so cross-user token theft via a
 * shared automation is prevented.
 *
 * If the stored token's `expiresAt` is in the past (or near-past, see
 * REFRESH_SKEW_MS), this function attempts an in-flight refresh against
 * the provider's token endpoint, persists the new tokens via the
 * encrypted upsert path, and returns the new accessToken. Concurrent
 * refreshes for the same (connectionId, userId) are deduplicated by
 * `withRefreshLock` so the provider sees at most one refresh request per
 * tuple at a time.
 *
 * Yields:
 *   - `'no-user-context'` when the automation has no userId (e.g. cron
 *     trigger) — caller surfaces this as a clear failure.
 *   - `'no-connection-row'` when the connection name isn't registered
 *     in `system.connections` (the user hasn't completed authorize yet).
 *   - `'no-token-for-user'` when the row exists but the user has no
 *     stored token (the user hasn't completed authorize yet).
 *   - refresh-failure reasons when the token is expired and the
 *     provider rejects the refresh (revoked, malformed response, etc.).
 */
