/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The OAuth2 authorization-code endpoints for `app.connections[]`.
 *
 *   GET    /api/connections/:name/authorize   → 302 to the provider's /authorize
 *   GET    /api/connections/:name/callback    → exchange the code, store the token
 *   GET    /api/connections/:name/status      → connection state for this caller
 *   GET    /api/connections/:name/users       → see `users-handler.ts`
 *   GET    /api/connections/:name/gif-search  → see `gif-handlers.ts` (and `/gifs/:id`)
 *   DELETE /api/connections/:name/disconnect  → drop this caller's credential
 *
 * ─── WHAT THIS FILE IS ──────────────────────────────────────────────────────
 *
 * The HTTP half of the flow: session guards, the admin gate on an `app`-scoped
 * connection, reading `code`/`state` off the query string, the `$env.` prop
 * resolution and the token exchange itself, and turning each outcome into an
 * RFC 6749-shaped envelope from `error-envelopes.ts`.
 *
 * What it stores lives in `@/application/use-cases/connections`: the state round
 * trip, the lazy `system.connections` upsert, the scope-dependent token write,
 * the status read and the disconnect. Those programs declare the repositories
 * and the state store they need and no status codes at all, so the automation
 * runtime reaches the same writes when it refreshes a credential.
 *
 * ─── TWO CHECKS THAT LOOK REDUNDANT AND ARE NOT ─────────────────────────────
 *
 * `requireAuthCodeFields` runs at BOTH the authorize and the callback boundary.
 * The prop schema marks `authorizationUrl`, `tokenUrl` and `redirectUri`
 * optional because the `clientCredentials` grant needs only `tokenUrl` (REC-3 in
 * `oauth2-props.ts`), so each entry point has to establish them for itself
 * rather than trusting the other to have run.
 *
 * The callback additionally binds the redeemed `state` to the session that
 * started the flow. That is defence in depth against CSRF and session fixation:
 * a leaked state value cannot be redeemed by a different signed-in user, and the
 * comparison has to happen here because the application layer cannot see which
 * session presented the code.
 */

import { randomBytes } from 'node:crypto'
import { Data, Effect } from 'effect'
import {
  effectiveScope,
  findConnection,
  type ConnectionDef,
} from '@/application/use-cases/connections/connection-definition'
import {
  deriveConnectionState,
  disconnectConnection,
  persistConnectionToken,
  readConnectionStatus,
} from '@/application/use-cases/connections/connection-tokens'
import { consumeOAuthState, saveOAuthState } from '@/application/use-cases/connections/oauth-state'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { generateCodeVerifier, generateOAuthState } from '@/domain/kernel/identity/pkce'
import {
  connectionCallbackResponseSchema,
  connectionDisconnectResponseSchema,
  connectionStatusResponseSchema,
} from '@/domain/models/api/connections'
import { isAdminTier } from '@/domain/models/app'
import { logError } from '@/infrastructure/logging/logger'
import { requireSession, notFound } from '@/presentation/api/runtime/auth-helpers'
import { answerFailures, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import { parseCallbackInputs } from './callback-inputs'
import { clientCredentialsStatus, usesClientCredentials } from './client-credentials-status'
import { connectionError } from './error-envelopes'
import { handleGifMedia, handleGifSearch } from './gif-handlers'
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  isPkceActive,
  resolveOAuth2PropsEnv,
} from './oauth-flow'
import { requireAuthCodeFields, type OAuth2AuthCodeProps, type OAuth2Props } from './oauth2-props'
import { handleListUsers } from './users-handler'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

const isOAuth2 = (conn: ConnectionDef): conn is ConnectionDef & { props: OAuth2Props } =>
  conn.type === 'oauth2'

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
const gateAdminForAppScope = (
  c: Context,
  conn: ReturnType<typeof findConnection>,
  userId: string,
  app: App
) =>
  Effect.gen(function* () {
    if (conn === undefined || !isOAuth2(conn)) return undefined
    if (effectiveScope(conn.props) !== 'app') return undefined
    const role = yield* getUserRole(userId)
    if (isAdminTier(role, app)) return undefined
    return notFound(c, 'Connection not found')
  })

function handleAuthorize(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const auth = requireSession(c)
        if (!auth.ok) return auth.response
        const name = c.req.param('name')
        if (name === undefined) return connectionError(c, 400, 'connection_name_required')
        const conn = findConnection(app, name)
        if (conn === undefined) return notFound(c, 'Connection not found')
        if (!isOAuth2(conn)) return connectionError(c, 400, 'connection_not_oauth2')

        const scopeGate = yield* gateAdminForAppScope(c, conn, auth.session.userId, app)
        if (scopeGate !== undefined) return scopeGate

        // REC-3: schema marks authorizationUrl/tokenUrl/redirectUri optional
        // (clientCredentials grant only needs tokenUrl). This helper enforces
        // them at the authorize entry point so we never call new URL(undefined).
        // `resolveOAuth2PropsEnv` first resolves `$env.VAR` placeholders (clientId/
        // urls/redirectUri/audience support env refs per the prop schema) so the
        // authorize URL carries the real values, not the literal `$env.…` string.
        const fieldsCheck = requireAuthCodeFields(
          c,
          resolveOAuth2PropsEnv(conn.props, app),
          `/api/connections/${name}/callback`
        )
        if ('response' in fieldsCheck) return fieldsCheck.response
        const { props } = fieldsCheck

        const state = generateOAuthState(randomBytes)
        const codeVerifier = isPkceActive(props.pkce)
          ? generateCodeVerifier(randomBytes)
          : undefined

        const saveResult = yield* saveOAuthState({
          state,
          connectionName: name,
          userId: auth.session.userId,
          codeVerifier,
          redirectUri: props.redirectUri,
        }).pipe(Effect.result)
        if (saveResult._tag === 'Failure') {
          logError('[connections] state save failed', saveResult.failure)
          return connectionError(c, 500, 'state_save_failed')
        }

        return c.redirect(buildAuthorizeUrl(props, state, codeVerifier), 302)
      })
    )
  )
}

/** The token endpoint call itself broke: not a refusal the provider answered. */
class TokenExchangeError extends Data.TaggedError('TokenExchangeError')<{
  readonly cause: unknown
}> {}

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

const resolveCallbackContext = (c: Context, app: App, userId: string) =>
  Effect.gen(function* (): Effect.fn.Return<
    ResolvedCallbackContext | { readonly response: Response },
    never,
    Effect.Services<ReturnType<typeof consumeOAuthState>>
  > {
    const inputs = parseCallbackInputs(c)
    if ('error' in inputs) return { response: connectionError(c, inputs.status, inputs.error) }

    const consumeResult = yield* consumeOAuthState(inputs.state).pipe(Effect.result)
    if (consumeResult._tag === 'Failure') {
      logError('[connections] state consume failed', consumeResult.failure)
      return { response: connectionError(c, 500, 'state_consume_failed') }
    }
    const stateEntry = consumeResult.success
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
      return { response: notFound(c, 'Connection not found') }
    }

    // Resolve `$env.VAR` placeholders before the /token exchange so the
    // clientId/clientSecret/tokenUrl/redirectUri sent to the provider are the
    // real values, not literal `$env.…` strings.
    const resolvedProps = resolveOAuth2PropsEnv(conn.props, app)

    // REC-3: schema marks the auth-code fields optional (clientCredentials
    // grant only needs tokenUrl). Validate them at the callback boundary so
    // exchangeCodeForToken can rely on them being defined.
    const fieldsCheck = requireAuthCodeFields(
      c,
      resolvedProps,
      `/api/connections/${inputs.name}/callback`
    )
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
  })

function handleCallback(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const auth = requireSession(c)
        if (!auth.ok) return auth.response
        const { session } = auth

        const ctx = yield* resolveCallbackContext(c, app, session.userId)
        if ('response' in ctx) return ctx.response

        const exchange = yield* Effect.tryPromise({
          try: () => exchangeCodeForToken(ctx.conn.props, ctx.code, ctx.codeVerifier),
          catch: (cause) => new TokenExchangeError({ cause }),
        })
        if (!exchange.ok)
          return connectionError(c, 502, 'token_exchange_failed', { detail: exchange.error })
        const accessToken = exchange.tokens.access_token
        if (accessToken === undefined || accessToken === '') {
          return connectionError(c, 502, 'token_response_missing_access_token')
        }

        const result = yield* persistConnectionToken({
          conn: ctx.conn,
          scope: effectiveScope(ctx.conn.props),
          userId: ctx.userId,
          credential: {
            accessToken,
            refreshToken: exchange.tokens.refresh_token,
            expiresAt:
              typeof exchange.tokens.expires_in === 'number'
                ? new Date(Date.now() + exchange.tokens.expires_in * 1000)
                : undefined,
            tokenFields: exchange.fields,
          },
        }).pipe(Effect.result)
        if (result._tag === 'Failure') {
          logError('[connections] token persistence failed', result.failure)
          return connectionError(c, 500, 'token_persistence_failed')
        }
        return shapedJson(
          c,
          { success: true, connectionId: result.success },
          connectionCallbackResponseSchema
        )
      })
    )
  )
}

function handleStatus(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const auth = requireSession(c)
        if (!auth.ok) return auth.response
        const { session } = auth
        const name = c.req.param('name')
        if (name === undefined) return connectionError(c, 400, 'connection_name_required')
        const conn = findConnection(app, name)
        if (conn === undefined) return notFound(c, 'Connection not found')
        const scopeGate = yield* gateAdminForAppScope(c, conn, session.userId, app)
        if (scopeGate !== undefined) return scopeGate
        if (usesClientCredentials(conn)) return yield* clientCredentialsStatus(c, conn)

        const result = yield* readConnectionStatus({ name, userId: session.userId }).pipe(
          Effect.result
        )
        if (result._tag === 'Failure') {
          logError('[connections] status lookup failed', result.failure)
          return connectionError(c, 500, 'status_lookup_failed')
        }
        const { connected, expiresAt } = result.success
        return shapedJson(
          c,
          {
            name,
            type: conn.type,
            status: deriveConnectionState(result.success),
            connected,
            expiresAt: expiresAt?.toISOString() ?? null,
          },
          connectionStatusResponseSchema
        )
      })
    )
  )
}

function handleDisconnect(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const auth = requireSession(c)
        if (!auth.ok) return auth.response
        const { session } = auth
        const name = c.req.param('name')
        if (name === undefined) return connectionError(c, 400, 'connection_name_required')
        const conn = findConnection(app, name)
        if (conn === undefined) return notFound(c, 'Connection not found')
        const scopeGate = yield* gateAdminForAppScope(c, conn, session.userId, app)
        if (scopeGate !== undefined) return scopeGate

        const result = yield* disconnectConnection({
          conn,
          isOAuth2: isOAuth2(conn),
          userId: session.userId,
        }).pipe(Effect.result)
        if (result._tag === 'Failure') {
          logError('[connections] disconnect failed', result.failure)
          return connectionError(c, 500, 'disconnect_failed')
        }
        return shapedJson(
          c,
          { success: true, deleted: result.success },
          connectionDisconnectResponseSchema
        )
      })
    )
  )
}

export function chainConnectionRoutes(honoApp: Hono, app: App): Hono {
  return honoApp
    .get('/api/connections/:name/authorize', (c) => handleAuthorize(c, app))
    .get('/api/connections/:name/callback', (c) => handleCallback(c, app))
    .get('/api/connections/:name/status', (c) => handleStatus(c, app))
    .get('/api/connections/:name/users', (c) => handleListUsers(c, app))
    .get('/api/connections/:name/gif-search', (c) => handleGifSearch(c, app))
    .get('/api/connections/:name/gifs/:id', (c) => handleGifMedia(c, app, false))
    .get('/api/connections/:name/gifs/:id/preview', (c) => handleGifMedia(c, app, true))
    .delete('/api/connections/:name/disconnect', (c) => handleDisconnect(c, app))
}
