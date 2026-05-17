/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connection-repository'
import {
  ConnectionTokenRepository,
  type ConnectionTokenPlaintext,
} from '@/application/ports/repositories/connection-token-repository'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'
import {
  refreshAccessToken,
  withRefreshLock,
  type OAuth2RefreshProps,
} from '@/infrastructure/connections/token-refresh'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connection-token-repository-live'
import { stringProp } from './shared'
import type { AutomationContext } from './shared'
import type { App } from '@/domain/models/app'

/**
 * Auth header injection for connection-bound HTTP requests.
 *
 * Static auth types (apiKey, basic, bearer) build their header purely from
 * the connection's in-memory props. OAuth2 connections require a DB lookup
 * keyed on the running automation's userId — cross-user token theft via a
 * shared automation is prevented because the token row is scoped by
 * `(connection_id, user_id)`.
 *
 * Public surface: `resolveConnectionHeaders`. Everything else is internal
 * scaffolding kept module-local.
 */

interface ConnectionDef {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

const findConnection = (app: App, name: string): ConnectionDef | undefined => {
  const list = (app as { connections?: readonly ConnectionDef[] }).connections ?? []
  return list.find((conn) => conn.name === name)
}

const buildStaticAuthHeader = (
  conn: ConnectionDef
): { readonly header: string; readonly value: string } | { readonly error: string } => {
  const { props } = conn
  if (conn.type === 'apiKey') {
    const key = stringProp(props, 'key')
    if (!key) return { error: `connection ${conn.name}: apiKey requires a key` }
    const headerName = stringProp(props, 'header') || 'X-API-Key'
    const prefix = stringProp(props, 'prefix')
    return { header: headerName, value: prefix ? `${prefix} ${key}` : key }
  }
  if (conn.type === 'bearer') {
    const token = stringProp(props, 'token')
    if (!token) return { error: `connection ${conn.name}: bearer requires a token` }
    return { header: 'Authorization', value: `Bearer ${token}` }
  }
  if (conn.type === 'basic') {
    const username = stringProp(props, 'username')
    const password = stringProp(props, 'password')
    if (!username) return { error: `connection ${conn.name}: basic requires a username` }
    const encoded = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
    return { header: 'Authorization', value: `Basic ${encoded}` }
  }
  return { error: `connection ${conn.name}: unsupported type ${conn.type}` }
}

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

const isExpired = (token: ConnectionTokenPlaintext): boolean => {
  if (token.expiresAt === undefined) return false
  return token.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS
}

/**
 * Build the `OAuth2RefreshProps` shape consumed by
 * `refreshAccessToken`. Mirrors the OAuth2Props read by
 * `connections/index.ts` but trimmed to the fields the refresh request
 * actually forwards. Returns `undefined` when any of the three required
 * client-config fields is missing — the caller surfaces this as a
 * "missing client config for refresh" failure rather than POSTing with
 * empty credentials.
 *
 * Note: `stringProp` returns `''` (not `undefined`) when a key is
 * missing on `conn.props`, so the required-field guard compares against
 * the empty string. The previous `=== undefined` check was dead code
 * and would have let a misconfigured connection POST to an empty URL.
 */
const buildRefreshProps = (conn: ConnectionDef): OAuth2RefreshProps | undefined => {
  const clientId = stringProp(conn.props, 'clientId')
  const clientSecret = stringProp(conn.props, 'clientSecret')
  const tokenUrl = stringProp(conn.props, 'tokenUrl')
  if (clientId === '' || clientSecret === '' || tokenUrl === '') {
    return undefined
  }
  const { scopes } = conn.props as { scopes?: readonly string[] }
  const audience = stringProp(conn.props, 'audience')
  const { extraTokenParams } = conn.props as {
    extraTokenParams?: Record<string, string>
  }
  const authMethod = stringProp(conn.props, 'authenticationMethod')
  return {
    clientId,
    clientSecret,
    tokenUrl,
    ...(scopes !== undefined ? { scopes } : {}),
    ...(audience !== '' ? { audience } : {}),
    ...(extraTokenParams !== undefined ? { extraTokenParams } : {}),
    ...(authMethod === 'header' || authMethod === 'body'
      ? { authenticationMethod: authMethod }
      : {}),
  }
}

/**
 * Wrap the upstream refresh call in an Effect, surfacing transport
 * failures as a typed error. The actual single-flight dedup is now
 * applied at the `performTokenRefresh` level so the locked unit
 * spans refresh AND persist — see comments there for the rationale
 * (closes the persist/findForUser race window flagged by
 * APP-AUTOMATION-CONNECTION-083).
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
    }
  | { readonly ok: false; readonly error: string },
  never
> =>
  Effect.tryPromise({
    try: () => refreshAccessToken(refreshProps, refreshToken),
    catch: (cause) => new RefreshTransportError({ cause }),
  }).pipe(
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
  readonly userId: string
  readonly accessToken: string
  readonly refreshToken: string | undefined
  readonly expiresAt: Date | undefined
}): Effect.Effect<
  { readonly ok: true } | { readonly ok: false },
  never,
  ConnectionTokenRepository
> =>
  Effect.gen(function* () {
    const tokenRepo = yield* ConnectionTokenRepository
    return yield* tokenRepo
      .upsertForUser({
        connectionId: input.connectionId,
        userId: input.userId,
        accessToken: input.accessToken,
        ...(input.refreshToken !== undefined ? { refreshToken: input.refreshToken } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      })
      .pipe(
        Effect.map(() => ({ ok: true }) as const),
        Effect.catchAll(() => Effect.succeed({ ok: false } as const))
      )
  })

type RefreshOutcome =
  | { readonly ok: true; readonly token: string }
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
 * succeed, so the row must survive (APP-AUTOMATION-CONNECTION-082).
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
  userId: string
): Effect.Effect<void, never, ConnectionTokenRepository> =>
  Effect.gen(function* () {
    const tokenRepo = yield* ConnectionTokenRepository
    yield* tokenRepo
      .deleteForUser({ connectionId, userId })
      .pipe(Effect.catchAll(() => Effect.void))
  })

/**
 * Run the refresh-token exchange and persist the new tokens through the
 * encrypted upsert path. Wrapped in `withRefreshLock` so concurrent
 * automations sharing a connection coalesce into a single upstream
 * refresh (APP-AUTOMATION-CONNECTION-069).
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
 *     (APP-AUTOMATION-CONNECTION-081).
 *   - 5xx (transient) or network error: keep the row; the next
 *     attempt may succeed (APP-AUTOMATION-CONNECTION-082).
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
 * Bundling persist into the lock closes the race window flagged by
 * APP-AUTOMATION-CONNECTION-083: the previous structure locked only
 * the upstream HTTP call, so caller B's `findForUser` could observe
 * the still-expired pre-refresh token between A's response landing
 * and A's `upsertForUser` completing — triggering a redundant second
 * refresh.
 */
const refreshAndPersistInner = (
  conn: ConnectionDef,
  token: ConnectionTokenPlaintext,
  connectionId: string,
  userId: string
): Effect.Effect<RefreshOutcome, never, ConnectionTokenRepository> =>
  Effect.gen(function* () {
    if (token.refreshToken === undefined || token.refreshToken === '') {
      return refreshFailure(conn, 'token expired and no refresh_token stored')
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
        yield* deleteStoredToken(connectionId, userId)
      }
      return refreshFailure(conn, `refresh failed (${result.error})`)
    }
    const persisted = yield* persistRefreshedTokens({
      connectionId,
      userId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    })
    if (!persisted.ok) {
      return refreshFailure(conn, 'refresh succeeded but token persistence failed')
    }
    return { ok: true, token: result.accessToken } as const
  })

/**
 * Single-flight refresh+persist for `(connectionId, userId)`. Wraps
 * `refreshAndPersistInner` with `withRefreshLock` so concurrent
 * automations sharing the same connection AND triggering user
 * coalesce into one upstream `/token` POST AND one `upsertForUser` —
 * the second arrival awaits the same Promise and reads the same
 * `RefreshOutcome` rather than re-fetching the token from the DB
 * (which is what the previous structure did, exposing the
 * persist/findForUser race that flaked APP-AUTOMATION-CONNECTION-083).
 *
 * Inner Effect → Promise conversion goes through the live token
 * repository layer because the lock is a Promise-shaped primitive
 * (`withRefreshLock` is in token-refresh.ts which has no Effect
 * Context dependency). The dynamic import mirrors the lazy-load
 * pattern used by `runSeedTestConnectionTokens` and `getUserRole`.
 */
const performTokenRefresh = (
  conn: ConnectionDef,
  token: ConnectionTokenPlaintext,
  connectionId: string,
  userId: string
): Effect.Effect<RefreshOutcome, never, never> =>
  Effect.tryPromise({
    try: () =>
      withRefreshLock({ connectionId, userId }, async () => {
        const program = refreshAndPersistInner(conn, token, connectionId, userId).pipe(
          Effect.provide(ConnectionTokenRepositoryLive)
        )
        return Effect.runPromise(program)
      }),
    catch: (cause) => new RefreshTransportError({ cause }),
  }).pipe(
    Effect.catchTag('RefreshTransportError', (err) =>
      Effect.succeed(
        refreshFailure(
          conn,
          err.cause instanceof Error ? err.cause.message : 'refresh_request_failed'
        )
      )
    )
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
 * tuple at a time (APP-AUTOMATION-CONNECTION-069).
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
const resolveOAuth2AccessToken = (
  conn: ConnectionDef,
  automation: AutomationContext
): Effect.Effect<
  { readonly ok: true; readonly token: string } | { readonly ok: false; readonly reason: string },
  never,
  ConnectionRepository | ConnectionTokenRepository
> =>
  Effect.gen(function* () {
    if (automation.userId === undefined) {
      return {
        ok: false,
        reason: `connection ${conn.name}: no user context (cron/system trigger)`,
      } as const
    }
    const connRepo = yield* ConnectionRepository
    const row = yield* connRepo.findByName(conn.name).pipe(Effect.catchAll(() => Effect.void))
    if (row === undefined) {
      return {
        ok: false,
        reason: `connection ${conn.name}: not yet authorized (no system.connections row)`,
      } as const
    }
    const connectionId = String(row['id'])
    const tokenRepo = yield* ConnectionTokenRepository
    const token = yield* tokenRepo
      .findForUser({
        connectionId,
        userId: automation.userId,
      })
      .pipe(Effect.catchAll(() => Effect.void))
    if (token === undefined) {
      return { ok: false, reason: `connection ${conn.name}: user has no stored token` } as const
    }
    // Test-mode seeder sentinel detection: the seeder upserts a placeholder
    // token at user-create time so encryption-at-rest specs have a row to
    // assert against (APP-AUTOMATION-CONNECTION-025/070). The sentinel must
    // never be injected into outbound HTTP requests — APP-AUTOMATION-
    // CONNECTION-077 explicitly asserts that a triggering user with no
    // real token gets a "no.*token|not.*authorized|disconnected" error.
    // Without this gate the seeder's 1h-TTL sentinel would silently flow to
    // upstream APIs as a Bearer header, masking the genuine failure mode.
    if (isSentinelAccessToken(token.accessToken)) {
      return {
        ok: false,
        reason: `connection ${conn.name}: user has not authorized (no token)`,
      } as const
    }
    if (isExpired(token)) {
      return yield* performTokenRefresh(conn, token, connectionId, automation.userId)
    }
    return { ok: true, token: token.accessToken } as const
  })

export interface InjectedHeaders {
  readonly headers: Record<string, string>
  readonly error?: string
}

/**
 * Verify that a connection's `system.connections` row still exists at
 * runtime. The startup seeder (`runSeedAllConnectionDefinitions`)
 * upserts a row for every connection in `app.connections[]`; this
 * lookup catches the "deleted out from under us" case
 * (APP-AUTOMATION-CONNECTION-089) where an operator removes the row
 * directly via SQL or the management UI. The error message names the
 * connection so the caller sees `will-be-removed` (or whatever the
 * connection is called) rather than a generic "connection error".
 *
 * Returns `undefined` on success, a refusal-reason string on failure.
 * The DB-error and not-found branches both surface as a refusal so
 * the action's run-history error is human-readable.
 */
const ensureConnectionExistsInDb = (
  connectionName: string
): Effect.Effect<string | undefined, never, ConnectionRepository> =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const row = yield* connRepo.findByName(connectionName).pipe(Effect.catchAll(() => Effect.void))
    if (row === undefined) {
      return `connection ${connectionName}: not found at runtime (was the connection deleted?)`
    }
    return undefined
  })

/**
 * Resolve the connection (if any) referenced by `props.connection`,
 * compute the auth header for the appropriate auth type, and merge it
 * into the request's headers. Static auth types (apiKey, basic, bearer)
 * are pure; oauth2 yields a DB lookup using `automation.userId`.
 *
 * Both static and oauth2 paths verify the connection's
 * `system.connections` row exists at runtime — startup seeds the row
 * for every connection in `app.connections[]`, so a missing row means
 * the connection was deleted between server start and trigger fire
 * (APP-AUTOMATION-CONNECTION-089). For oauth2 the existence check is
 * inlined in `resolveOAuth2AccessToken` (it already does
 * findByName); for static types we do an explicit lookup before
 * building the header so the error surfaces with the connection name.
 *
 * Returns the merged headers OR a clear error string for the handler
 * to surface as an action failure.
 */
export const resolveConnectionHeaders = (
  app: App,
  automation: AutomationContext,
  baseHeaders: Record<string, string>,
  connectionName: string
): Effect.Effect<InjectedHeaders, never, ConnectionRepository | ConnectionTokenRepository> =>
  Effect.gen(function* () {
    const conn = findConnection(app, connectionName)
    if (conn === undefined) {
      return {
        headers: baseHeaders,
        error: `connection ${connectionName}: not found in app config`,
      }
    }
    if (conn.type === 'oauth2') {
      const result = yield* resolveOAuth2AccessToken(conn, automation)
      if (!result.ok) return { headers: baseHeaders, error: result.reason }
      return {
        headers: { ...baseHeaders, Authorization: `Bearer ${result.token}` },
      }
    }
    // Static auth types (apiKey/basic/bearer): the in-memory props are
    // sufficient to build the header, but we still require a DB row so
    // a runtime DELETE (operator action, accidental cascade, manual SQL)
    // surfaces as a clear action failure rather than silently succeeding.
    const dbMissing = yield* ensureConnectionExistsInDb(connectionName)
    if (dbMissing !== undefined) return { headers: baseHeaders, error: dbMissing }
    const built = buildStaticAuthHeader(conn)
    if ('error' in built) return { headers: baseHeaders, error: built.error }
    return { headers: { ...baseHeaders, [built.header]: built.value } }
  })
