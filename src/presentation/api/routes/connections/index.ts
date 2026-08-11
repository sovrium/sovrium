/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import { OAuthStateStore } from '@/application/ports/services/oauth-state-store'
import { isAdminTier } from '@/domain/models/app'
import { generateCodeVerifier, generateOAuthState } from '@/domain/utils/auth/pkce'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { requireSession, unauthorized } from '@/presentation/api/utils/auth-helpers'
import { provideConnectionLive } from './effect-runner'
import { connectionError } from './error-envelopes'
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  isPkceActive,
  resolveOAuth2PropsEnv,
  type OAuthTokenResponse,
} from './oauth-flow'
import { requireAuthCodeFields, type OAuth2AuthCodeProps, type OAuth2Props } from './oauth2-props'
import { handleListUsers } from './users-handler'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Tagged failure type for connection-route Effect programs.
 *
 * Replaces the previous pattern of `Effect.mapError((err) => new Error(...))`,
 * which collapsed all repository/store errors into the global `Error` type and
 * lost discriminability in the failure channel (Effect diagnostic
 * `globalErrorInEffectFailure`).
 *
 * `operation` identifies the call site for log/debug context; `cause` preserves
 * the original error so root-cause information survives the boundary.
 */
class ConnectionRouteError extends Data.TaggedError('ConnectionRouteError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

/**
 * OAuth2 authorization-code flow + token CRUD for `app.connections[]`.
 *
 * Connection definitions live in the app config (clientId, scopes,
 * URLs, PKCE method, etc.); per-user tokens live in
 * `system.connection_tokens` (encrypted at rest via `crypto/token-encrypt.ts`).
 *
 * On first authorize for a given connection name, we lazily upsert the
 * `system.connections` row so `connection_tokens.connection_id` has a
 * valid FK target. This mirrors the lazy-seed pattern from the
 * automations subsystem (plan 01a).
 *
 * Routes:
 *   GET    /api/connections/:name/authorize    → 302 to provider's /authorize
 *   GET    /api/connections/:name/callback     → exchange code, store token
 *   GET    /api/connections/:name/status       → connection state for current user
 *   DELETE /api/connections/:name/disconnect   → revoke + delete user's token row
 */

// OAuth2Props, OAuth2AuthCodeProps, and requireAuthCodeFields live in
// `./oauth2-props.ts` to keep this file under the 400-line max-lines budget.
// See REC-3 in that file for the schema/runtime drift rationale.

interface ConnectionDef {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

const findConnection = (app: App, name: string): ConnectionDef | undefined => {
  const list = (app as { connections?: readonly ConnectionDef[] }).connections ?? []
  return list.find((conn) => conn.name === name)
}

const isOAuth2 = (conn: ConnectionDef): conn is ConnectionDef & { props: OAuth2Props } =>
  conn.type === 'oauth2'

/**
 * Lazy upsert: ensure a `system.connections` row exists for this
 * connection name. Returns the row's `id`.
 *
 * Atomic via `upsertByName` (INSERT ... ON CONFLICT DO UPDATE on the
 * `connections_name_unique` index). Two concurrent first-authorize
 * requests for the same connection name both succeed and resolve to
 * the same row (audit H3).
 *
 * Audit H2: `credentials: {}` — the full OAuth props (incl.
 * `clientSecret`) live in the in-memory `app.connections[]` config and
 * are read at OAuth-callback time via `findConnection(app, name)`.
 * Persisting them as plaintext JSONB would duplicate the secret to
 * disk for no read-path benefit. The column stays populated with `{}`
 * to honor NOT NULL; a future migration can drop the column entirely.
 */
const resolveConnectionId = (
  conn: ConnectionDef
): Effect.Effect<string, ConnectionRouteError, ConnectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* ConnectionRepository
    const row = yield* repo
      .upsertByName({
        name: conn.name,
        provider: String((conn.props as Record<string, unknown>)['provider'] ?? conn.name),
        type: conn.type,
        credentials: {},
      })
      .pipe(
        Effect.mapError((cause) => new ConnectionRouteError({ operation: 'upsertByName', cause }))
      )
    return String(row['id'] ?? '')
  })

/**
 * Resolve the connection's effective scope. Default is 'app' (admin-only,
 * single shared token). 'user' opts the connection into per-user tokens
 * accessible to any authenticated user.
 */
const effectiveScope = (props: OAuth2Props): 'app' | 'user' => props.scope ?? 'app'

/**
 * Z-3 enumeration-prevention pattern: when an OAuth2 connection is `app`-scoped
 * (admin-managed), non-admin callers receive 404 — same response as if the
 * connection didn't exist. Returns `undefined` if the caller is permitted, or
 * a 404 response if not.
 *
 * For non-OAuth2 connections (apiKey/bearer/basic) and `user`-scoped OAuth2,
 * any signed-in user is permitted.
 *
 * The admin check goes through the canonical, custom-role-aware
 * {@link isAdminTier} predicate (threading the live `app`) rather than a literal
 * `role === 'admin'` check: a partner-style custom TOP role (e.g. `engineer`,
 * level 80, which resolves to a dashboard tier) is admin-tier and is admitted,
 * while a plain `member`/anon still 404s. Mirrors the
 * `requireAdminTier`/`makeAdminGuard` posture on the `/api/admin/*` surface.
 */
const gateAdminForAppScope = async (
  c: Context,
  conn: ReturnType<typeof findConnection>,
  userId: string,
  app: App
): Promise<Response | undefined> => {
  if (conn === undefined || !isOAuth2(conn)) return undefined
  if (effectiveScope(conn.props) !== 'app') return undefined
  const role = await resolveUserRole(userId)
  if (isAdminTier(role, app)) return undefined
  return connectionError(c, 404, 'connection_not_found')
}

/**
 * Lazy import to avoid bundler-time circular references between the
 * connections route file and the auth use-case module. `getUserRole`
 * itself lazy-loads `AuthRepositoryLive`, so this two-level lazy chain
 * keeps `connection-routes` independent of the database adapter at
 * import time. Mirrors the pattern in `requireAdminHandler`.
 */
const resolveUserRole = async (userId: string): Promise<string> => {
  const { getUserRole } = await import('@/application/use-cases/tables/user-role')
  return getUserRole(userId)
}

async function handleAuthorize(c: Context, app: App) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const name = c.req.param('name')
  if (name === undefined) return connectionError(c, 400, 'connection_name_required')
  const conn = findConnection(app, name)
  if (conn === undefined) return connectionError(c, 404, 'connection_not_found')
  if (!isOAuth2(conn)) return connectionError(c, 400, 'connection_not_oauth2')

  const scopeGate = await gateAdminForAppScope(c, conn, session.userId, app)
  if (scopeGate !== undefined) return scopeGate

  // REC-3: schema marks authorizationUrl/tokenUrl/redirectUri optional
  // (clientCredentials grant only needs tokenUrl). This helper enforces
  // them at the authorize entry point so we never call new URL(undefined).
  // `resolveOAuth2PropsEnv` first resolves `$env.VAR` placeholders (clientId/
  // urls/redirectUri/audience support env refs per the prop schema) so the
  // authorize URL carries the real values, not the literal `$env.…` string.
  const fieldsCheck = requireAuthCodeFields(c, resolveOAuth2PropsEnv(conn.props, app))
  if ('response' in fieldsCheck) return fieldsCheck.response
  const { props } = fieldsCheck

  const state = generateOAuthState()
  const codeVerifier = isPkceActive(props.pkce) ? generateCodeVerifier() : undefined

  const saveProgram = Effect.gen(function* () {
    const store = yield* OAuthStateStore
    yield* store.save(state, {
      connectionName: name,
      userId: session.userId,
      codeVerifier,
      redirectUri: props.redirectUri,
    })
  })
  const saveResult = await runRequestEffect(
    c,
    provideConnectionLive(saveProgram).pipe(Effect.either)
  )
  if (saveResult._tag === 'Left') {
    logError('[connections] state save failed', saveResult.left)
    return connectionError(c, 500, 'state_save_failed')
  }

  return c.redirect(buildAuthorizeUrl(props, state, codeVerifier), 302)
}

interface CallbackInputs {
  readonly code: string
  readonly state: string
  readonly name: string
}

const parseCallbackInputs = (
  c: Context
): CallbackInputs | { readonly error: string; readonly status: 400 } => {
  const name = c.req.param('name')
  const code = c.req.query('code')
  const state = c.req.query('state')
  if (name === undefined) return { error: 'connection_name_required', status: 400 as const }
  if (code === undefined || code === '' || state === undefined || state === '') {
    return { error: 'missing_code_or_state', status: 400 as const }
  }
  return { code, state, name }
}

const persistTokenProgram = (input: {
  readonly conn: ConnectionDef & { props: OAuth2Props }
  readonly userId: string
  readonly tokens: OAuthTokenResponse
  readonly accessToken: string
}) =>
  Effect.gen(function* () {
    // resolveConnectionId already fails with ConnectionRouteError; no remap needed.
    const connectionId = yield* resolveConnectionId(input.conn)
    const tokenRepo = yield* ConnectionTokenRepository
    yield* tokenRepo
      .upsertForUser({
        connectionId,
        userId: input.userId,
        accessToken: input.accessToken,
        ...(input.tokens.refresh_token !== undefined
          ? { refreshToken: input.tokens.refresh_token }
          : {}),
        ...(typeof input.tokens.expires_in === 'number'
          ? { expiresAt: new Date(Date.now() + input.tokens.expires_in * 1000) }
          : {}),
      })
      .pipe(
        Effect.mapError((cause) => new ConnectionRouteError({ operation: 'upsertForUser', cause }))
      )
    return connectionId
  })

interface ResolvedCallbackContext {
  /**
   * Connection with the auth-code-flow props verified — `requireAuthCodeFields`
   * has confirmed `authorizationUrl`, `tokenUrl`, and `redirectUri` are all
   * present non-empty strings.
   */
  readonly conn: ConnectionDef & { props: OAuth2AuthCodeProps }
  readonly codeVerifier: string | undefined
  readonly code: string
  readonly userId: string
}

const resolveCallbackContext = async (
  c: Context,
  app: App,
  userId: string
): Promise<ResolvedCallbackContext | { readonly response: Response }> => {
  const inputs = parseCallbackInputs(c)
  if ('error' in inputs) return { response: connectionError(c, inputs.status, inputs.error) }

  const consumeProgram = Effect.gen(function* () {
    const store = yield* OAuthStateStore
    return yield* store.consume(inputs.state)
  })
  const consumeResult = await runRequestEffect(
    c,
    provideConnectionLive(consumeProgram).pipe(Effect.either)
  )
  if (consumeResult._tag === 'Left') {
    logError('[connections] state consume failed', consumeResult.left)
    return { response: connectionError(c, 500, 'state_consume_failed') }
  }
  const stateEntry = consumeResult.right
  if (stateEntry === undefined || stateEntry.connectionName !== inputs.name) {
    return { response: connectionError(c, 400, 'invalid_state_or_mismatch') }
  }
  // Bind state to the original session user (defense-in-depth against
  // CSRF / session-fixation: a leaked state value cannot be redeemed by a
  // different signed-in user). If session changed mid-flow, force restart.
  if (stateEntry.userId !== userId) {
    return { response: connectionError(c, 400, 'state_user_mismatch') }
  }

  const conn = findConnection(app, inputs.name)
  if (conn === undefined || !isOAuth2(conn)) {
    return { response: connectionError(c, 404, 'connection_not_found') }
  }

  // Resolve `$env.VAR` placeholders before the /token exchange so the
  // clientId/clientSecret/tokenUrl/redirectUri sent to the provider are the
  // real values, not literal `$env.…` strings.
  const resolvedProps = resolveOAuth2PropsEnv(conn.props, app)

  // REC-3: schema marks the auth-code fields optional (clientCredentials
  // grant only needs tokenUrl). Validate them at the callback boundary so
  // exchangeCodeForToken can rely on them being defined.
  const fieldsCheck = requireAuthCodeFields(c, resolvedProps)
  if ('response' in fieldsCheck) return { response: fieldsCheck.response }

  // The structural shape is correct (OAuth2AuthCodeProps strictly extends
  // the runtime fields we read), but the explicit `Record<string, unknown>`
  // index on ConnectionDef doesn't combine with a typed interface; assert
  // through ConnectionDef to satisfy the typechecker without widening.
  const refinedConn = { ...conn, props: fieldsCheck.props } as ConnectionDef & {
    props: OAuth2AuthCodeProps
  }
  return {
    conn: refinedConn,
    codeVerifier: stateEntry.codeVerifier,
    code: inputs.code,
    userId,
  }
}

async function handleCallback(c: Context, app: App) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)

  const ctx = await resolveCallbackContext(c, app, session.userId)
  if ('response' in ctx) return ctx.response

  const exchange = await exchangeCodeForToken(ctx.conn.props, ctx.code, ctx.codeVerifier)
  if (!exchange.ok)
    return connectionError(c, 502, 'token_exchange_failed', { detail: exchange.error })
  const accessToken = exchange.tokens.access_token
  if (accessToken === undefined || accessToken === '') {
    return connectionError(c, 502, 'token_response_missing_access_token')
  }

  const result = await runRequestEffect(
    c,
    provideConnectionLive(
      persistTokenProgram({
        conn: ctx.conn,
        userId: ctx.userId,
        tokens: exchange.tokens,
        accessToken,
      })
    ).pipe(Effect.either)
  )
  if (result._tag === 'Left') {
    logError('[connections] token persistence failed', result.left)
    return connectionError(c, 500, 'token_persistence_failed')
  }
  return c.json({ success: true, connectionId: result.right }, 200)
}

/**
 * Look up the (connection, token) state for the given user. Extracted
 * from `handleStatus` so the handler stays under the line-count threshold
 * and so the lookup can be reused by future routes (e.g. /info).
 *
 * Returns `connected: false` when the stored token is the test-mode
 * seeder's sentinel (see `isSentinelAccessToken`) — without this gate,
 * tests that create a user against a `scope: 'user'` connection would
 * always observe 'connected' status because the seeder upserts a 1h-TTL
 * sentinel row at user-create time. Specs [internal ref]
 * and -077 specifically test the "user has NOT yet authorized" state
 * and require the sentinel to be invisible to the status / injection
 * paths.
 */
const statusLookupProgram = (input: { readonly name: string; readonly userId: string }) =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const row = yield* connRepo
      .findByName(input.name)
      .pipe(
        Effect.mapError((cause) => new ConnectionRouteError({ operation: 'findByName', cause }))
      )
    if (row === undefined) {
      return { connected: false, expiresAt: undefined as Date | undefined }
    }
    const tokenRepo = yield* ConnectionTokenRepository
    const token = yield* tokenRepo
      .findForUser({ connectionId: String(row['id']), userId: input.userId })
      .pipe(
        Effect.mapError((cause) => new ConnectionRouteError({ operation: 'findForUser', cause }))
      )
    if (token === undefined || isSentinelAccessToken(token.accessToken)) {
      return { connected: false, expiresAt: undefined as Date | undefined }
    }
    return {
      connected: true,
      expiresAt: token.expiresAt,
    }
  })

/**
 * Map (connected, expiresAt) into the textual status the spec asserts on.
 * 'expired' is reported when a token row exists but its `expiresAt` is
 * in the past — the automation runtime treats this as an opportunity to
 * refresh (handled in C-2 token-refresh, not here).
 */
const deriveStatus = (
  connected: boolean,
  expiresAt: Date | undefined
): 'connected' | 'disconnected' | 'expired' => {
  if (!connected) return 'disconnected'
  if (expiresAt !== undefined && expiresAt.getTime() < Date.now()) return 'expired'
  return 'connected'
}

async function handleStatus(c: Context, app: App) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const name = c.req.param('name')
  if (name === undefined) return connectionError(c, 400, 'connection_name_required')
  const conn = findConnection(app, name)
  if (conn === undefined) return connectionError(c, 404, 'connection_not_found')
  const scopeGate = await gateAdminForAppScope(c, conn, session.userId, app)
  if (scopeGate !== undefined) return scopeGate

  const result = await runRequestEffect(
    c,
    provideConnectionLive(statusLookupProgram({ name, userId: session.userId })).pipe(Effect.either)
  )
  if (result._tag === 'Left') {
    logError('[connections] status lookup failed', result.left)
    return connectionError(c, 500, 'status_lookup_failed')
  }
  const { connected, expiresAt } = result.right
  const status = deriveStatus(connected, expiresAt)
  return c.json(
    {
      name,
      type: conn.type,
      status,
      connected,
      // eslint-disable-next-line unicorn/no-null -- contract field; null when no expiry recorded
      expiresAt: expiresAt?.toISOString() ?? null,
    },
    200
  )
}

async function handleDisconnect(c: Context, app: App) {
  const session = requireSession(c)
  if (session === undefined) {
    return unauthorized(c)
  }
  const name = c.req.param('name')
  if (name === undefined) return connectionError(c, 400, 'connection_name_required')
  const conn = findConnection(app, name)
  if (conn === undefined) return connectionError(c, 404, 'connection_not_found')
  const scopeGate = await gateAdminForAppScope(c, conn, session.userId, app)
  if (scopeGate !== undefined) return scopeGate

  const program = Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const row = yield* connRepo
      .findByName(name)
      .pipe(
        Effect.mapError((cause) => new ConnectionRouteError({ operation: 'findByName', cause }))
      )
    if (row === undefined) return false
    const tokenRepo = yield* ConnectionTokenRepository
    return yield* tokenRepo
      .deleteForUser({ connectionId: String(row['id']), userId: session.userId })
      .pipe(
        Effect.mapError((cause) => new ConnectionRouteError({ operation: 'deleteForUser', cause }))
      )
  })

  const result = await runRequestEffect(c, provideConnectionLive(program).pipe(Effect.either))
  if (result._tag === 'Left') {
    logError('[connections] disconnect failed', result.left)
    return connectionError(c, 500, 'disconnect_failed')
  }
  return c.json({ success: true, deleted: result.right }, 200)
}

/* eslint-disable drizzle/enforce-delete-with-where -- the `.delete()` below is a Hono route definition, not a Drizzle delete */
export function chainConnectionRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .get('/api/connections/:name/authorize', (c) => handleAuthorize(c, app))
    .get('/api/connections/:name/callback', (c) => handleCallback(c, app))
    .get('/api/connections/:name/status', (c) => handleStatus(c, app))
    .get('/api/connections/:name/users', (c) => handleListUsers(c, app))
    .delete('/api/connections/:name/disconnect', (c) => handleDisconnect(c, app)) as T
}
/* eslint-enable drizzle/enforce-delete-with-where */
