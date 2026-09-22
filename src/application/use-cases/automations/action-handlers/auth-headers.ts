/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import {
  ConnectionTokenRepository,
  type ConnectionAppTokenPlaintext,
  type ConnectionTokenPlaintext,
} from '@/application/ports/repositories/connections/connection-token-repository'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'
import {
  refreshAccessToken,
  withRefreshLockEffect,
  type OAuth2RefreshProps,
} from '@/infrastructure/connections/token-refresh'
import { isEncryptionKeyMismatch } from '@/infrastructure/errors/encryption-key-mismatch-error'
import { logError } from '@/infrastructure/logging/logger'
import { buildEnvLookup } from '../resolve-env-vars'
import { stringProp } from './shared'
import { buildStaticAuthHeader, type ConnectionDef } from './static-auth-header'
import type { AutomationContext } from './shared'
import type { App } from '@/domain/models/app'
import type { Context } from 'effect'

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

const findConnection = (app: App, name: string): ConnectionDef | undefined => {
  const list = (app as { connections?: readonly ConnectionDef[] }).connections ?? []
  return list.find((conn) => conn.name === name)
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

/**
 * The fields the refresh machinery reads from a stored token, common to the
 * per-user row and the shared `app`-scoped row. Both plaintext shapes satisfy
 * it; the shared one simply has no `userId` to satisfy.
 */
interface StoredToken {
  readonly accessToken: string
  readonly refreshToken: string | undefined
  readonly expiresAt: Date | undefined
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
const connectionScope = (conn: ConnectionDef, automation: AutomationContext): TokenScope => {
  const declared = (conn.props as { scope?: unknown }).scope
  if (declared === 'user') {
    return automation.userId === undefined
      ? { kind: 'user', userId: '' }
      : { kind: 'user', userId: automation.userId }
  }
  return { kind: 'app' }
}

const isExpired = (token: StoredToken): boolean => {
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
 * [internal ref]).
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
  readonly scope: TokenScope
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
    const common = {
      connectionId: input.connectionId,
      accessToken: input.accessToken,
      ...(input.refreshToken !== undefined ? { refreshToken: input.refreshToken } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    }
    const write =
      input.scope.kind === 'user'
        ? tokenRepo.upsertForUser({ ...common, userId: input.scope.userId })
        : tokenRepo.upsertForApp(common)
    return yield* write.pipe(
      Effect.map(() => ({ ok: true }) as const),
      // effect-swallow: the failure is not lost, it is RETURNED — `{ ok: false }` is the caller's branch for "the token was not stored", and it is checked. This converts a channel, it does not discard one.
      Effect.orElseSucceed(() => ({ ok: false }) as const)
    )
  })

type RefreshOutcome =
  { readonly ok: true; readonly token: string } | { readonly ok: false; readonly reason: string }

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
): Effect.Effect<void, never, ConnectionTokenRepository> =>
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
 * attempt may succeed.
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
 * [internal ref]: the previous structure locked only
 * the upstream HTTP call, so caller B's `findForUser` could observe
 * the still-expired pre-refresh token between A's response landing
 * and A's `upsertForUser` completing — triggering a redundant second
 * refresh.
 */
const refreshAndPersistInner = (
  conn: ConnectionDef,
  token: StoredToken,
  connectionId: string,
  scope: TokenScope
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
 * persist/findForUser race that flaked [internal ref]).
 *
 * The lock is a Promise-shaped primitive, so crossing into Promise
 * land is inherent to it. `withRefreshLockEffect` owns that crossing
 * (it lives beside the lock in token-refresh.ts) and runs the inner
 * program on the services THIS fiber already holds, so the token
 * repository is the automation runtime's rather than a fresh one per
 * arrival.
 */
const performTokenRefresh = (
  conn: ConnectionDef,
  token: StoredToken,
  connectionId: string,
  scope: TokenScope
): Effect.Effect<RefreshOutcome, never, ConnectionTokenRepository> =>
  withRefreshLockEffect(
    { connectionId, userId: scopeUserId(scope) },
    refreshAndPersistInner(conn, token, connectionId, scope),
    (cause) => new RefreshTransportError({ cause })
  ).pipe(
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
/**
 * Outcome of reading a user's stored token.
 *
 * `absent` and `unreadable` used to collapse into the same value, and that
 * collapse is the defect this type exists to prevent: they call for opposite
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
 * The read failure used to be swallowed into `Effect.void`, collapsing both into
 * "no stored token". That is the worst available confusion: it points the
 * operator at a user who never connected, while the real cause is that every
 * connected user's credentials just became unreadable. See
 * [internal ref].
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
 * too — the pre-existing [internal ref] matches a miss against
 * `/disconnected|not.*authorized|no.*token/i`, and that spec is about a
 * scope-omitted (therefore app-scoped) connection.
 */
const appNotConnectedReason = (conn: ConnectionDef): string =>
  `connection ${conn.name}: not connected — no token stored; ` +
  'an administrator must connect it from the Connections page'

const resolveAppScopedToken = (
  conn: ConnectionDef,
  connectionId: string
): Effect.Effect<
  { readonly ok: true; readonly token: string } | { readonly ok: false; readonly reason: string },
  never,
  ConnectionTokenRepository
> =>
  Effect.gen(function* () {
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
    if (isSentinelAccessToken(token.accessToken)) {
      return { ok: false, reason: appNotConnectedReason(conn) } as const
    }
    if (isExpired(token)) {
      return yield* performTokenRefresh(conn, token, connectionId, { kind: 'app' })
    }
    return { ok: true, token: token.accessToken } as const
  })

const resolveUserScopedToken = (
  conn: ConnectionDef,
  connectionId: string,
  userId: string
): Effect.Effect<
  { readonly ok: true; readonly token: string } | { readonly ok: false; readonly reason: string },
  never,
  ConnectionTokenRepository
> =>
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
    // Test-mode seeder sentinel detection: the seeder upserts a placeholder
    // token at user-create time so encryption-at-rest specs have a row to
    // assert against. The sentinel must
    // never be injected into outbound HTTP requests — [internal ref] explicitly asserts that a triggering user with no
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
      return yield* performTokenRefresh(conn, token, connectionId, { kind: 'user', userId })
    }
    return { ok: true, token: token.accessToken } as const
  })

/**
 * Look a connection row up, keeping "the store failed" distinct from "there is
 * no such row".
 *
 * Both used to arrive as `undefined` (`Effect.catch(() => Effect.void)`), so a
 * database outage was reported to the operator as `not yet authorized` or
 * `was the connection deleted?` — an instruction to go and re-authorize a
 * connection that is fine, while the actual fault left no trace anywhere. The
 * REFUSAL is correct and stays (an action failing is not a server error); what
 * changes is that it now says which of the two happened, and logs the cause.
 *
 * `ok: false` carries the refusal wording so both callers phrase a lookup
 * failure identically; `ok: true` with `row: undefined` is a genuine miss.
 */
const lookupConnectionRow = (name: string) =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const outcome = yield* Effect.result(connRepo.findByName(name))
    if (outcome._tag === 'Success') return { ok: true, row: outcome.success } as const
    logError('Connection lookup failed while resolving automation auth headers', outcome.failure, {
      'sovrium.connection.name': name,
    })
    const reason = `connection ${name}: lookup failed (the connection store could not be read)`
    return { ok: false, reason } as const
  })

const resolveOAuth2AccessToken = (
  conn: ConnectionDef,
  automation: AutomationContext
): Effect.Effect<
  { readonly ok: true; readonly token: string } | { readonly ok: false; readonly reason: string },
  never,
  ConnectionRepository | ConnectionTokenRepository
> =>
  Effect.gen(function* () {
    const scope = connectionScope(conn, automation)
    // `user` scope keeps refusing, and keeps refusing in the same words. A
    // per-user credential genuinely cannot be chosen when there is no user,
    // and picking someone's token arbitrarily is the privilege confusion this
    // whole feature exists to avoid. The guard stays FIRST on this branch so
    // the message is reached before any lookup can change it.
    if (scope.kind === 'user' && automation.userId === undefined) {
      return {
        ok: false,
        reason: `connection ${conn.name}: no user context (cron/system trigger)`,
      } as const
    }
    const lookup = yield* lookupConnectionRow(conn.name)
    if (!lookup.ok) return lookup
    const { row } = lookup
    if (row === undefined) {
      return {
        ok: false,
        reason: `connection ${conn.name}: not yet authorized (no system.connections row)`,
      } as const
    }
    const connectionId = String(row['id'])
    return yield* scope.kind === 'app'
      ? resolveAppScopedToken(conn, connectionId)
      : resolveUserScopedToken(conn, connectionId, scope.userId)
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
 * where an operator removes the row
 * directly via SQL or the management UI. The error message names the
 * connection so the caller sees `will-be-removed` (or whatever the
 * connection is called) rather than a generic "connection error".
 *
 * Returns `undefined` on success, a refusal-reason string on failure.
 * Both the DB-error and the not-found branch surface as a refusal — an action
 * failing is not a server error — but they no longer surface as the SAME
 * refusal: telling an operator the connection was deleted when the store simply
 * could not be read sends them to fix the wrong thing.
 */
const ensureConnectionExistsInDb = (
  connectionName: string
): Effect.Effect<string | undefined, never, ConnectionRepository> =>
  Effect.gen(function* () {
    const lookup = yield* lookupConnectionRow(connectionName)
    if (!lookup.ok) return lookup.reason
    if (lookup.row === undefined) {
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
 *. For oauth2 the existence check is
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
  baseHeaders: Readonly<Record<string, string>>,
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
    // Resolve `$env.` in secret-bearing connection props against the app's
    // declared env vars + the OS environment. Connection definitions are read
    // straight off `app.connections[]` (never through the upstream action-prop
    // env substitution), so a `key: '$env.MY_TOKEN'` ref would otherwise reach
    // the wire verbatim.
    const envLookup = buildEnvLookup(app.env, process.env)
    const built = buildStaticAuthHeader(conn, envLookup)
    if ('error' in built) return { headers: baseHeaders, error: built.error }
    return { headers: { ...baseHeaders, [built.header]: built.value } }
  }).pipe(Effect.withSpan('automations.resolve-connection-headers'))
