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

class ConnectionRouteError extends Data.TaggedError('ConnectionRouteError')<{
  readonly operation: string
  readonly cause: unknown
}> {}



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

const effectiveScope = (props: OAuth2Props): 'app' | 'user' => props.scope ?? 'app'

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
  const saveResult = await Effect.runPromise(provideConnectionLive(saveProgram).pipe(Effect.either))
  if (saveResult._tag === 'Left') {
    console.error('[connections] state save failed', saveResult.left)
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
  const consumeResult = await Effect.runPromise(
    provideConnectionLive(consumeProgram).pipe(Effect.either)
  )
  if (consumeResult._tag === 'Left') {
    console.error('[connections] state consume failed', consumeResult.left)
    return { response: connectionError(c, 500, 'state_consume_failed') }
  }
  const stateEntry = consumeResult.right
  if (stateEntry === undefined || stateEntry.connectionName !== inputs.name) {
    return { response: connectionError(c, 400, 'invalid_state_or_mismatch') }
  }
  if (stateEntry.userId !== userId) {
    return { response: connectionError(c, 400, 'state_user_mismatch') }
  }

  const conn = findConnection(app, inputs.name)
  if (conn === undefined || !isOAuth2(conn)) {
    return { response: connectionError(c, 404, 'connection_not_found') }
  }

  const resolvedProps = resolveOAuth2PropsEnv(conn.props, app)

  const fieldsCheck = requireAuthCodeFields(c, resolvedProps)
  if ('response' in fieldsCheck) return { response: fieldsCheck.response }

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

  const result = await Effect.runPromise(
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
    console.error('[connections] token persistence failed', result.left)
    return connectionError(c, 500, 'token_persistence_failed')
  }
  return c.json({ success: true, connectionId: result.right }, 200)
}

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

  const result = await Effect.runPromise(
    provideConnectionLive(statusLookupProgram({ name, userId: session.userId })).pipe(Effect.either)
  )
  if (result._tag === 'Left') {
    console.error('[connections] status lookup failed', result.left)
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

  const result = await Effect.runPromise(provideConnectionLive(program).pipe(Effect.either))
  if (result._tag === 'Left') {
    console.error('[connections] disconnect failed', result.left)
    return connectionError(c, 500, 'disconnect_failed')
  }
  return c.json({ success: true, deleted: result.right }, 200)
}

export function chainConnectionRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .get('/api/connections/:name/authorize', (c) => handleAuthorize(c, app))
    .get('/api/connections/:name/callback', (c) => handleCallback(c, app))
    .get('/api/connections/:name/status', (c) => handleStatus(c, app))
    .get('/api/connections/:name/users', (c) => handleListUsers(c, app))
    .delete('/api/connections/:name/disconnect', (c) => handleDisconnect(c, app)) as T
}
