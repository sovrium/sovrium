/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import {
  OAuthStateStore,
  type OAuthStateEntry,
} from '@/application/ports/services/oauth-state-store'
import { generateCodeVerifier, generateOAuthState } from '@/domain/utils/auth/pkce'
import { provideAdminConnectionsLive } from '@/presentation/api/routes/admin/connections/effect-runner'
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  isPkceActive,
  resolveOAuth2PropsEnv,
  type OAuthTokenResponse,
} from '@/presentation/api/routes/connections/oauth-flow'
import {
  requireAuthCodeFields,
  type OAuth2AuthCodeProps,
  type OAuth2Props,
} from '@/presentation/api/routes/connections/oauth2-props'
import { requireSession, unauthorized } from '@/presentation/api/utils/auth-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

type ConnectionRow = Record<string, unknown>

class AdminConnectionActionError extends Data.TaggedError('AdminConnectionActionError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

const actionError = (c: Context, status: 400 | 404 | 500 | 502, error: string) =>
  c.json({ error }, status)

interface ConnectionConfigDef {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

const findConfig = (app: App, name: string): ConnectionConfigDef | undefined => {
  const list = (app as { connections?: readonly ConnectionConfigDef[] }).connections ?? []
  return list.find((conn) => conn.name === name)
}

const runAdmin = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  Effect.runPromise(provideAdminConnectionsLive(program).pipe(Effect.either))

type LookupResult =
  | { readonly _tag: 'Found'; readonly row: ConnectionRow }
  | { readonly _tag: 'Missing' }
  | { readonly _tag: 'Failed'; readonly response: Response }

const lookupConnection = async (
  c: Context,
  key: { readonly by: 'id' | 'name'; readonly value: string }
): Promise<LookupResult> => {
  const result = await runAdmin(
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
  if (result._tag === 'Left') {
    console.error('[admin] connection lookup failed', result.left)
    return { _tag: 'Failed', response: actionError(c, 500, 'connection_lookup_failed') }
  }
  return result.right === undefined ? { _tag: 'Missing' } : { _tag: 'Found', row: result.right }
}


const resolveAuthorizeProps = async (
  c: Context,
  app: App,
  row: ConnectionRow
): Promise<{ readonly props: OAuth2AuthCodeProps } | { readonly response: Response }> => {
  if (String(row['type']) !== 'oauth2') {
    return { response: actionError(c, 400, 'connection_not_oauth2') }
  }
  const conn = findConfig(app, String(row['name']))
  if (conn === undefined || conn.type !== 'oauth2') {
    return { response: actionError(c, 400, 'connection_not_oauth2') }
  }
  const resolvedProps = resolveOAuth2PropsEnv(conn.props as unknown as OAuth2Props, app)
  const fieldsCheck = requireAuthCodeFields(c, resolvedProps)
  if ('response' in fieldsCheck) return { response: fieldsCheck.response }
  return { props: fieldsCheck.props }
}

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
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const id = c.req.param('id')
  if (id === undefined || id === '') return actionError(c, 404, 'connection_not_found')

  const lookup = await lookupConnection(c, { by: 'id', value: id })
  if (lookup._tag === 'Failed') return lookup.response
  if (lookup._tag === 'Missing') return actionError(c, 404, 'connection_not_found')
  const { row } = lookup

  const resolved = await resolveAuthorizeProps(c, app, row)
  if ('response' in resolved) return resolved.response
  const { props } = resolved

  const state = generateOAuthState()
  const codeVerifier = isPkceActive(props.pkce) ? generateCodeVerifier() : undefined

  const saveResult = await runAdmin(
    saveAuthorizeState({
      state,
      connectionName: String(row['name']),
      userId: session.userId,
      codeVerifier,
      redirectUri: props.redirectUri,
    })
  )
  if (saveResult._tag === 'Left') {
    console.error('[admin] connection authorize state save failed', saveResult.left)
    return actionError(c, 500, 'state_save_failed')
  }

  return c.json({ authorizationUrl: buildAuthorizeUrl(props, state, codeVerifier) }, 200)
}


interface ResolvedCallback {
  readonly props: OAuth2AuthCodeProps
  readonly connectionId: string
  readonly userId: string
  readonly code: string
  readonly codeVerifier: string | undefined
}

interface CallbackInputs {
  readonly name: string
  readonly code: string
  readonly state: string
}

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

const consumeCallbackState = async (
  c: Context,
  inputs: CallbackInputs,
  userId: string
): Promise<OAuthStateEntry | { readonly response: Response }> => {
  const consume = await runAdmin(
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
  if (consume._tag === 'Left') {
    console.error('[admin] connection callback state consume failed', consume.left)
    return { response: actionError(c, 500, 'state_consume_failed') }
  }
  const entry = consume.right
  if (entry === undefined || entry.connectionName !== inputs.name) {
    return { response: actionError(c, 400, 'invalid_state_or_mismatch') }
  }
  if (entry.userId !== userId) {
    return { response: actionError(c, 400, 'state_user_mismatch') }
  }
  return entry
}

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
    code: inputs.code,
    codeVerifier: entry.codeVerifier,
  }
}

const persistToken = (input: {
  readonly connectionId: string
  readonly userId: string
  readonly tokens: OAuthTokenResponse
  readonly accessToken: string
}) =>
  Effect.gen(function* () {
    const tokenRepo = yield* ConnectionTokenRepository
    yield* tokenRepo
      .upsertForUser({
        connectionId: input.connectionId,
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
        Effect.mapError(
          (cause) => new AdminConnectionActionError({ operation: 'upsertForUser', cause })
        )
      )
  })

async function handleCallback(c: Context, app: App): Promise<Response> {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)

  const ctx = await resolveCallback(c, app, session.userId)
  if ('response' in ctx) return ctx.response

  const exchange = await exchangeCodeForToken(ctx.props, ctx.code, ctx.codeVerifier)
  if (!exchange.ok) return actionError(c, 502, 'token_exchange_failed')
  const accessToken = exchange.tokens.access_token
  if (accessToken === undefined || accessToken === '') {
    return actionError(c, 502, 'token_response_missing_access_token')
  }

  const persistResult = await runAdmin(
    persistToken({
      connectionId: ctx.connectionId,
      userId: ctx.userId,
      tokens: exchange.tokens,
      accessToken,
    })
  )
  if (persistResult._tag === 'Left') {
    console.error('[admin] connection callback token persistence failed', persistResult.left)
    return actionError(c, 500, 'token_persistence_failed')
  }

  return c.redirect('/_admin/connections', 302)
}


async function handleDisconnect(c: Context): Promise<Response> {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const id = c.req.param('id')
  if (id === undefined || id === '') return actionError(c, 404, 'connection_not_found')

  const result = await runAdmin(
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
      yield* tokenRepo
        .deleteForConnection(String(row['id']))
        .pipe(
          Effect.mapError(
            (cause) => new AdminConnectionActionError({ operation: 'deleteForConnection', cause })
          )
        )
      return { found: true as const }
    })
  )
  if (result._tag === 'Left') {
    console.error('[admin] connection disconnect failed', result.left)
    return actionError(c, 500, 'disconnect_failed')
  }
  if (!result.right.found) return actionError(c, 404, 'connection_not_found')
  return c.json({ success: true }, 200)
}

export function chainAdminConnectionActionRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .post('/api/admin/connections/:id/authorize', (c) => handleAuthorize(c, app))
    .get('/api/admin/connections/:name/callback', (c) => handleCallback(c, app))
    .post('/api/admin/connections/:id/disconnect', (c) => handleDisconnect(c)) as T
}
