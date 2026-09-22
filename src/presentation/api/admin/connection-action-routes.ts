/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin-tier action endpoints for the **App Connections** family — the mutating
 * sibling of the read-only `connections.ts` viewer. The operator-driven,
 * Zapier-style authorize → consent → callback → token-exchange round-trip, plus
 * disconnect:
 *
 *   - POST /api/admin/connections/:id/authorize    → 200 JSON { authorizationUrl }
 *     (id-keyed: the dashboard already knows the runtime uuid). Builds the
 *     provider authorize URL + CSRF state + PKCE S256; persists the state +
 *     verifier server-side keyed to the operator. The dashboard island opens the
 *     URL itself, so the API returns it as DATA (not a 302).
 *   - GET  /api/admin/connections/:name/callback    → 302 /_admin/connections
 *     (NAME-keyed: the provider's registered redirect_uri must be config-stable
 *     across restarts). Validates the state, exchanges the code (+ PKCE verifier)
 *     for tokens at the provider tokenUrl, ENCRYPTS + persists them, then 302s.
 *   - POST /api/admin/connections/:id/disconnect    → 200 JSON { success: true }
 *     (id-keyed). Deletes every stored token row for the connection so it returns
 *     to the unconnected state (`tokenCount === 0`).
 *
 * The connection ROW lives in the RUNTIME DB (`system.connections`, seeded from
 * `app.connections` at boot) and is resolved by id (authorize/disconnect) or
 * name (callback); the OAuth PROPS (clientId/clientSecret/urls) live ONLY in the
 * `app.connections` config and are resolved by the row's NAME. The boot `app` is
 * threaded in by the route-setup composition root.
 *
 * Auth gating is wired upstream by `authMiddleware` + `requireAdminTier()` on the
 * `/api/admin/connections/*` wildcard (api-routes.ts) — the tier-aware guard
 * admits a custom top role (partner's `engineer`) and 404s `member`/anon (S1
 * anti-enumeration). NO literal `role === 'admin'` check lives here.
 *
 * ⛔ SECURITY (S4 — absolute): the authorize response body + the callback
 * redirect NEVER echo secret material. Tokens are encrypted at rest by
 * `upsertForUser`; the clientSecret is never serialized.
 */

import { Data, Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import {
  OAuthStateStore,
  type OAuthStateEntry,
} from '@/application/ports/services/oauth-state-store'
import { generateCodeVerifier, generateOAuthState } from '@/domain/kernel/identity/pkce'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  isPkceActive,
  resolveOAuth2PropsEnv,
  type OAuthTokenResponse,
} from '@/presentation/api/connections/oauth-flow'
import {
  requireAuthCodeFields,
  type OAuth2AuthCodeProps,
  type OAuth2Props,
} from '@/presentation/api/connections/oauth2-props'
import { errorBody, requireSession } from '@/presentation/api/runtime/auth-helpers'
import { requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

type ConnectionRow = Record<string, unknown>

/** Tagged failure type for the admin connection-action Effect programs. */
class AdminConnectionActionError extends Data.TaggedError('AdminConnectionActionError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

/**
 * Status -> canonical code and human-readable wording for a connection action.
 *
 * `satisfies` is the point: widening {@link actionError}'s status union without
 * deciding what the new status MEANS breaks this table at compile time, rather
 * than letting the new status inherit whatever the last branch happened to say.
 */
const ACTION_ERROR_BY_STATUS = {
  400: { code: ApiErrorCode.BAD_REQUEST, message: 'The connection action was refused' },
  404: { code: ApiErrorCode.NOT_FOUND, message: 'No such connection' },
  500: { code: ApiErrorCode.INTERNAL_ERROR, message: 'The connection action failed' },
  502: {
    code: ApiErrorCode.BAD_GATEWAY,
    message: 'The connection provider could not be reached',
  },
} satisfies Record<400 | 404 | 500 | 502, { readonly code: ApiErrorCode; readonly message: string }>

/**
 * A connection-action refusal.
 *
 * This used to build its own `{ error }` envelope — a second wire shape beside
 * the canonical one, with no `message` for a human and no `code` to branch on.
 * It now builds the canonical envelope and keeps the short slug in `error`,
 * which is what `[internal ref]` matches on.
 */
const actionError = (c: Context, status: 400 | 404 | 500 | 502, error: string) =>
  c.json(errorBody({ error, ...ACTION_ERROR_BY_STATUS[status] }), status)

interface ConnectionConfigDef {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

/** Resolve a connection config block from `app.connections` by name. */
const findConfig = (app: App, name: string): ConnectionConfigDef | undefined => {
  const list = (app as { connections?: readonly ConnectionConfigDef[] }).connections ?? []
  return list.find((conn) => conn.name === name)
}

/**
 * Run an Effect program against THIS request's connection services, return Either.
 *
 * Takes the Hono context because the services come from the runtime the running
 * server owns, resolved once at boot — see `provideDomain`.
 */
const runAdmin = <A, E>(
  c: Context,
  program: Effect.Effect<A, E, ConnectionRepository | ConnectionTokenRepository | OAuthStateStore>
) => Effect.runPromise(provideDomain(c, program).pipe(Effect.result))

/**
 * Resolve a runtime `system.connections` row by id or name. The tagged result
 * cleanly distinguishes a hit, a per-resource miss, and a lookup failure (the
 * raw row is a `Record<string, unknown>`, so a plain `{ response }` union would
 * be ambiguous).
 */
type LookupResult =
  | { readonly _tag: 'Found'; readonly row: ConnectionRow }
  | { readonly _tag: 'Missing' }
  | { readonly _tag: 'Failed'; readonly response: Response }

const lookupConnection = async (
  c: Context,
  key: { readonly by: 'id' | 'name'; readonly value: string }
): Promise<LookupResult> => {
  const result = await runAdmin(
    c,
    Effect.gen(function* () {
      const connRepo = yield* ConnectionRepository
      const op = key.by === 'id' ? connRepo.findById(key.value) : connRepo.findByName(key.value)
      return yield* op.pipe(
        Effect.mapError(
          (cause) => new AdminConnectionActionError({ operation: `find_${key.by}`, cause })
        )
      )
    })
  )
  if (result._tag === 'Failure') {
    logError('[admin] connection lookup failed', result.failure, requestLogAttributes(c))
    return { _tag: 'Failed', response: actionError(c, 500, 'connection_lookup_failed') }
  }
  return result.success === undefined ? { _tag: 'Missing' } : { _tag: 'Found', row: result.success }
}

// ─── authorize (id-keyed) ───────────────────────────────────────────────────

/**
 * Resolve + validate the authorize target: the runtime row must exist and be
 * oauth2, AND a matching oauth2 config block with the auth-code fields must be
 * present. Returns the validated props or a Response to return verbatim.
 */
const resolveAuthorizeProps = async (
  c: Context,
  app: App,
  row: ConnectionRow
): Promise<{ readonly props: OAuth2AuthCodeProps } | { readonly response: Response }> => {
  // Only oauth2 connections have an authorize action — an apiKey/bearer/basic
  // connection holds a static secret and has no consent flow → 400.
  if (String(row['type']) !== 'oauth2') {
    return { response: actionError(c, 400, 'connection_not_oauth2') }
  }
  // Resolve the OAuth props from the live config by the row's NAME (the DB row
  // does not hold clientId/clientSecret/urls).
  const conn = findConfig(app, String(row['name']))
  if (conn === undefined || conn.type !== 'oauth2') {
    return { response: actionError(c, 400, 'connection_not_oauth2') }
  }
  // Resolve `$env.VAR` placeholders (clientId/clientSecret/urls/redirectUri/
  // audience support env refs per the prop schema) BEFORE field validation so
  // every downstream consumer (buildAuthorizeUrl, the /token exchange) sees the
  // real values, not the literal `$env.…` string.
  const resolvedProps = resolveOAuth2PropsEnv(conn.props as unknown as OAuth2Props, app)
  // REC-3: the schema marks authorizationUrl/tokenUrl/redirectUri optional
  // (clientCredentials only needs tokenUrl). Enforce them so we never call
  // new URL(undefined).
  const fieldsCheck = requireAuthCodeFields(c, resolvedProps)
  if ('response' in fieldsCheck) return { response: fieldsCheck.response }
  return { props: fieldsCheck.props }
}

/** Persist the CSRF state + PKCE verifier keyed to the operator. */
const saveAuthorizeState = (input: {
  readonly state: string
  readonly connectionName: string
  readonly userId: string
  readonly codeVerifier: string | undefined
  readonly redirectUri: string
}) =>
  Effect.gen(function* () {
    const store = yield* OAuthStateStore
    yield* store
      .save(input.state, {
        connectionName: input.connectionName,
        userId: input.userId,
        codeVerifier: input.codeVerifier,
        redirectUri: input.redirectUri,
      })
      .pipe(
        Effect.mapError(
          (cause) => new AdminConnectionActionError({ operation: 'state.save', cause })
        )
      )
  })

async function handleAuthorize(c: Context, app: App): Promise<Response> {
  const auth = requireSession(c)
  if (!auth.ok) return auth.response
  const { session } = auth
  const id = c.req.param('id')
  if (id === undefined || id === '') return actionError(c, 404, 'connection_not_found')

  const lookup = await lookupConnection(c, { by: 'id', value: id })
  if (lookup._tag === 'Failed') return lookup.response
  // Unknown connection id → anti-enum 404 (per-resource miss; the tier guard
  // already 404s non-admin callers).
  if (lookup._tag === 'Missing') return actionError(c, 404, 'connection_not_found')
  const { row } = lookup

  const resolved = await resolveAuthorizeProps(c, app, row)
  if ('response' in resolved) return resolved.response
  const { props } = resolved

  const state = generateOAuthState()
  const codeVerifier = isPkceActive(props.pkce) ? generateCodeVerifier() : undefined

  const saveResult = await runAdmin(
    c,
    saveAuthorizeState({
      state,
      connectionName: String(row['name']),
      userId: session.userId,
      codeVerifier,
      redirectUri: props.redirectUri,
    })
  )
  if (saveResult._tag === 'Failure') {
    logError(
      '[admin] connection authorize state save failed',
      saveResult.failure,
      requestLogAttributes(c)
    )
    return actionError(c, 500, 'state_save_failed')
  }

  return c.json({ authorizationUrl: buildAuthorizeUrl(props, state, codeVerifier) }, 200)
}

// ─── callback (name-keyed) ──────────────────────────────────────────────────

interface ResolvedCallback {
  readonly props: OAuth2AuthCodeProps
  readonly connectionId: string
  readonly userId: string
  /**
   * Which credential store the exchanged token belongs in. Defaults to `app`,
   * matching `effectiveScope` on the runtime connection routes — the two must
   * agree, or an operator authorizes into one store while every automation
   * reads the other.
   */
  readonly scope: 'app' | 'user'
  readonly code: string
  readonly codeVerifier: string | undefined
}

interface CallbackInputs {
  readonly name: string
  readonly code: string
  readonly state: string
}

/** Parse + require the callback query params; a 400 Response on any miss. */
const parseCallbackInputs = (c: Context): CallbackInputs | { readonly response: Response } => {
  const name = c.req.param('name')
  const code = c.req.query('code')
  const state = c.req.query('state')
  if (name === undefined || name === '') {
    return { response: actionError(c, 400, 'connection_name_required') }
  }
  if (code === undefined || code === '' || state === undefined || state === '') {
    return { response: actionError(c, 400, 'missing_code_or_state') }
  }
  return { name, code, state }
}

/**
 * Consume + validate the callback state (CSRF / replay protection) and bind it
 * to the original operator. Returns the matched entry or a Response (400 for a
 * forged/mismatched/replayed state — refused BEFORE any /token POST).
 */
const consumeCallbackState = async (
  c: Context,
  inputs: CallbackInputs,
  userId: string
): Promise<OAuthStateEntry | { readonly response: Response }> => {
  const consume = await runAdmin(
    c,
    Effect.gen(function* () {
      const store = yield* OAuthStateStore
      return yield* store
        .consume(inputs.state)
        .pipe(
          Effect.mapError(
            (cause) => new AdminConnectionActionError({ operation: 'state.consume', cause })
          )
        )
    })
  )
  if (consume._tag === 'Failure') {
    logError(
      '[admin] connection callback state consume failed',
      consume.failure,
      requestLogAttributes(c)
    )
    return { response: actionError(c, 500, 'state_consume_failed') }
  }
  const entry = consume.success
  // Unknown/expired state OR a state issued for a different connection → 400.
  if (entry === undefined || entry.connectionName !== inputs.name) {
    return { response: actionError(c, 400, 'invalid_state_or_mismatch') }
  }
  // Defense-in-depth: bind the state to the operator who issued it.
  if (entry.userId !== userId) {
    return { response: actionError(c, 400, 'state_user_mismatch') }
  }
  return entry
}

/**
 * Validate the callback's state then resolve the config props + the runtime
 * connection row id. Returns a ready-to-exchange context or a Response verbatim.
 */
async function resolveCallback(
  c: Context,
  app: App,
  userId: string
): Promise<ResolvedCallback | { readonly response: Response }> {
  const inputs = parseCallbackInputs(c)
  if ('response' in inputs) return inputs

  const entry = await consumeCallbackState(c, inputs, userId)
  if ('response' in entry) return entry

  const conn = findConfig(app, inputs.name)
  if (conn === undefined || conn.type !== 'oauth2') {
    return { response: actionError(c, 404, 'connection_not_found') }
  }
  // Resolve `$env.VAR` placeholders before the /token exchange so the
  // clientId/clientSecret/tokenUrl/redirectUri sent to the provider are the
  // real values, not literal `$env.…` strings.
  const resolvedProps = resolveOAuth2PropsEnv(conn.props as unknown as OAuth2Props, app)
  const fieldsCheck = requireAuthCodeFields(c, resolvedProps)
  if ('response' in fieldsCheck) return { response: fieldsCheck.response }

  const lookup = await lookupConnection(c, { by: 'name', value: inputs.name })
  if (lookup._tag === 'Failed') return { response: lookup.response }
  if (lookup._tag === 'Missing') return { response: actionError(c, 404, 'connection_not_found') }

  return {
    props: fieldsCheck.props,
    connectionId: String(lookup.row['id']),
    userId,
    scope: resolvedProps.scope === 'user' ? 'user' : 'app',
    code: inputs.code,
    codeVerifier: entry.codeVerifier,
  }
}

/**
 * Persist the exchanged token (encrypted at rest) into the store the
 * connection's `scope` dictates — the SHARED row for `app` scope (the
 * default), the operator's own row for `user` scope.
 *
 * `app` scope writes no per-user row on purpose: `connection_tokens.user_id`
 * is `ON DELETE cascade`, so filing a company-wide credential under the
 * operator who happened to click Connect makes offboarding them silently
 * delete it.
 */
const persistToken = (input: {
  readonly connectionId: string
  readonly userId: string
  readonly scope: 'app' | 'user'
  readonly tokens: OAuthTokenResponse
  readonly accessToken: string
}) =>
  Effect.gen(function* () {
    const tokenRepo = yield* ConnectionTokenRepository
    const common = {
      connectionId: input.connectionId,
      accessToken: input.accessToken,
      ...(input.tokens.refresh_token !== undefined
        ? { refreshToken: input.tokens.refresh_token }
        : {}),
      ...(typeof input.tokens.expires_in === 'number'
        ? { expiresAt: new Date(Date.now() + input.tokens.expires_in * 1000) }
        : {}),
    }
    const write =
      input.scope === 'app'
        ? tokenRepo.upsertForApp(common)
        : tokenRepo.upsertForUser({ ...common, userId: input.userId })
    yield* write.pipe(
      Effect.mapError(
        (cause) => new AdminConnectionActionError({ operation: 'persistToken', cause })
      )
    )
  })

async function handleCallback(c: Context, app: App): Promise<Response> {
  const auth = requireSession(c)
  if (!auth.ok) return auth.response
  const { session } = auth

  const ctx = await resolveCallback(c, app, session.userId)
  if ('response' in ctx) return ctx.response

  const exchange = await exchangeCodeForToken(ctx.props, ctx.code, ctx.codeVerifier)
  if (!exchange.ok) return actionError(c, 502, 'token_exchange_failed')
  const accessToken = exchange.tokens.access_token
  if (accessToken === undefined || accessToken === '') {
    return actionError(c, 502, 'token_response_missing_access_token')
  }

  const persistResult = await runAdmin(
    c,
    persistToken({
      connectionId: ctx.connectionId,
      userId: ctx.userId,
      scope: ctx.scope,
      tokens: exchange.tokens,
      accessToken,
    })
  )
  if (persistResult._tag === 'Failure') {
    logError(
      '[admin] connection callback token persistence failed',
      persistResult.failure,
      requestLogAttributes(c)
    )
    return actionError(c, 500, 'token_persistence_failed')
  }

  // Land back on the dashboard connections page. The redirect body carries no
  // token/secret material (S4).
  return c.redirect('/_admin/connections', 302)
}

// ─── disconnect (id-keyed) ──────────────────────────────────────────────────

async function handleDisconnect(c: Context): Promise<Response> {
  const auth = requireSession(c)
  if (!auth.ok) return auth.response
  const id = c.req.param('id')
  if (id === undefined || id === '') return actionError(c, 404, 'connection_not_found')

  const result = await runAdmin(
    c,
    Effect.gen(function* () {
      const connRepo = yield* ConnectionRepository
      const row = yield* connRepo
        .findById(id)
        .pipe(
          Effect.mapError(
            (cause) => new AdminConnectionActionError({ operation: 'find_id', cause })
          )
        )
      if (row === undefined) return { found: false as const }
      const tokenRepo = yield* ConnectionTokenRepository
      const connectionId = String(row['id'])
      // Clear BOTH stores. Clearing only the shared row would leave a
      // pre-upgrade per-user row behind, and the adoption on the injection
      // path would then resurrect the credential the operator just revoked —
      // on the cron jobs, which are exactly the callers nobody is watching.
      yield* tokenRepo
        .deleteForConnection(connectionId)
        .pipe(
          Effect.mapError(
            (cause) => new AdminConnectionActionError({ operation: 'deleteForConnection', cause })
          )
        )
      yield* tokenRepo
        .deleteForApp({ connectionId })
        .pipe(
          Effect.mapError(
            (cause) => new AdminConnectionActionError({ operation: 'deleteForApp', cause })
          )
        )
      return { found: true as const }
    })
  )
  if (result._tag === 'Failure') {
    logError('[admin] connection disconnect failed', result.failure, requestLogAttributes(c))
    return actionError(c, 500, 'disconnect_failed')
  }
  // Unknown connection id → anti-enum 404.
  if (!result.success.found) return actionError(c, 404, 'connection_not_found')
  return c.json({ success: true }, 200)
}

/**
 * Chain the admin connection ACTION routes onto a Hono app. Auth gating is wired
 * upstream (`requireAdminTier` on `/api/admin/connections/*`). The boot `app` is
 * threaded in for the by-name OAuth-props resolution.
 *
 * Registration order: the two-segment `:id/authorize`, `:name/callback`,
 * `:id/disconnect` action paths are distinct from the single-segment `:id`
 * detail route registered by `chainAdminConnectionsRoutes`, so they never
 * shadow it.
 */
export function chainAdminConnectionActionRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .post('/api/admin/connections/:id/authorize', (c) => handleAuthorize(c, app))
    .get('/api/admin/connections/:name/callback', (c) => handleCallback(c, app))
    .post('/api/admin/connections/:id/disconnect', (c) => handleDisconnect(c)) as T
}
