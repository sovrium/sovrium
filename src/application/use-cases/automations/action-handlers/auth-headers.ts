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
  type ConnectionTokenPlaintext,
} from '@/application/ports/repositories/connections/connection-token-repository'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'
import {
  refreshAccessToken,
  withRefreshLock,
  type OAuth2RefreshProps,
} from '@/infrastructure/connections/token-refresh'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import { buildEnvLookup, resolveEnvInString } from '../resolve-env-vars'
import { stringProp } from './shared'
import type { AutomationContext } from './shared'
import type { App } from '@/domain/models/app'


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
  conn: ConnectionDef,
  envLookup: Readonly<Record<string, string>>
): { readonly header: string; readonly value: string } | { readonly error: string } => {
  const { props } = conn
  const secretProp = (key: string): string => resolveEnvInString(stringProp(props, key), envLookup)
  if (conn.type === 'apiKey') {
    const key = secretProp('key')
    if (!key) return { error: `connection ${conn.name}: apiKey requires a key` }
    const headerName = stringProp(props, 'header') || 'X-API-Key'
    const prefix = stringProp(props, 'prefix')
    return { header: headerName, value: prefix ? `${prefix} ${key}` : key }
  }
  if (conn.type === 'bearer') {
    const token = secretProp('token')
    if (!token) return { error: `connection ${conn.name}: bearer requires a token` }
    return { header: 'Authorization', value: `Bearer ${token}` }
  }
  if (conn.type === 'basic') {
    const username = secretProp('username')
    const password = secretProp('password')
    if (!username) return { error: `connection ${conn.name}: basic requires a username` }
    const encoded = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
    return { header: 'Authorization', value: `Basic ${encoded}` }
  }
  return { error: `connection ${conn.name}: unsupported type ${conn.type}` }
}

class RefreshTransportError extends Data.TaggedError('RefreshTransportError')<{
  readonly cause: unknown
}> {}

const REFRESH_SKEW_MS = 5000

const isExpired = (token: ConnectionTokenPlaintext): boolean => {
  if (token.expiresAt === undefined) return false
  return token.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS
}

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
  { readonly ok: true; readonly token: string } | { readonly ok: false; readonly reason: string }

const refreshFailure = (conn: ConnectionDef, suffix: string): RefreshOutcome =>
  ({ ok: false, reason: `connection ${conn.name}: ${suffix}` }) as const

const isPermanentRefreshFailure = (errorTag: string): boolean =>
  errorTag.startsWith('refresh_endpoint_4xx')

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
    const dbMissing = yield* ensureConnectionExistsInDb(connectionName)
    if (dbMissing !== undefined) return { headers: baseHeaders, error: dbMissing }
    const envLookup = buildEnvLookup(app.env, process.env)
    const built = buildStaticAuthHeader(conn, envLookup)
    if ('error' in built) return { headers: baseHeaders, error: built.error }
    return { headers: { ...baseHeaders, [built.header]: built.value } }
  })
