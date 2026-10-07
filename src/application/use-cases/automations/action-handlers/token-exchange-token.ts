/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash } from 'node:crypto'
import { Data, Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import {
  OAuthTokenClient,
  type TokenExchangeRequest,
} from '@/application/ports/services/oauth-token-client'
import { SentinelTokens } from '@/application/ports/services/sentinel-tokens'
import { logError } from '@/infrastructure/logging/logger'
import { resolveEnvInString } from '../resolve-env-vars'
import type { ConnectionDef } from './static-auth-header'

/**
 * The `tokenExchange` connection type: a stored credential traded at
 * `tokenUrl` for a short-lived token, which is cached until it expires.
 *
 * Storage, lock and configuration fingerprint are the client-credentials
 * path's: the token is the connection's shared (`app`) credential, stored
 * encrypted; concurrent first calls share one token request; and a token
 * obtained under another configuration — a rotated key, another endpoint —
 * is not reused. Only the fingerprint's hash is stored, never the credential.
 */

class TokenExchangeTransportError extends Data.TaggedError('TokenExchangeTransportError')<{
  readonly cause: unknown
}> {}

export type TokenExchangeOutcome =
  | { readonly ok: true; readonly header: string; readonly value: string }
  | { readonly ok: false; readonly reason: string }

/** A stored token this close to its expiry is treated as expired. */
const EXPIRY_SKEW_MS = 5000

interface TokenExchangeConfig {
  readonly request: TokenExchangeRequest
  readonly header: string
  readonly prefix: string
}

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

/** Read the connection's props, every `$env.VAR` resolved. */
const readConfig = (
  conn: ConnectionDef,
  envLookup: Readonly<Record<string, string>>
): TokenExchangeConfig => {
  const props = conn.props as Readonly<Record<string, unknown>>
  const rawBody = (props['body'] ?? {}) as Readonly<Record<string, unknown>>
  return {
    request: {
      tokenUrl: resolveEnvInString(stringOr(props['tokenUrl'], ''), envLookup),
      body: Object.fromEntries(
        Object.entries(rawBody).map(([key, value]) => [
          key,
          resolveEnvInString(String(value), envLookup),
        ])
      ),
      bodyType: props['bodyType'] === 'form' ? 'form' : 'json',
      tokenPath: stringOr(props['tokenPath'], 'access_token'),
      expiresInPath: stringOr(props['expiresInPath'], 'expires_in'),
    },
    header: stringOr(props['header'], 'Authorization'),
    prefix: stringOr(props['prefix'], 'Bearer'),
  }
}

const fingerprint = (request: TokenExchangeRequest): string =>
  createHash('sha256')
    .update(
      JSON.stringify([
        'tokenExchange',
        request.tokenUrl,
        request.body,
        request.bodyType,
        request.tokenPath,
        request.expiresInPath,
      ])
    )
    .digest('hex')

const toHeader = (config: TokenExchangeConfig, token: string): TokenExchangeOutcome => ({
  ok: true,
  header: config.header,
  value: config.prefix === '' ? token : `${config.prefix} ${token}`,
})

const requestAndStore = (
  conn: ConnectionDef,
  config: TokenExchangeConfig,
  connectionId: string
): Effect.Effect<TokenExchangeOutcome, never, ConnectionTokenRepository | OAuthTokenClient> =>
  Effect.gen(function* () {
    const result = yield* OAuthTokenClient.use((tokens) =>
      tokens.requestExchangedToken(config.request)
    ).pipe(
      Effect.mapError((error) => new TokenExchangeTransportError({ cause: error.cause })),
      Effect.catchTag('TokenExchangeTransportError', () =>
        Effect.succeed({ ok: false as const, error: 'token_request_failed' })
      )
    )
    if (!result.ok) {
      return {
        ok: false,
        reason: `connection ${conn.name}: token request refused (${result.error})`,
      } as const
    }
    const tokenRepo = yield* ConnectionTokenRepository
    const stored = yield* tokenRepo
      .upsertForApp({
        connectionId,
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
        grantFingerprint: fingerprint(config.request),
      })
      .pipe(
        Effect.map(() => true),
        // effect-swallow: the failure is RETURNED as `false` and turned into the step's refusal below; a token that cannot be stored is not used, or every call would ask the endpoint again.
        Effect.orElseSucceed(() => false)
      )
    if (!stored) {
      return {
        ok: false,
        reason: `connection ${conn.name}: token obtained but could not be stored`,
      } as const
    }
    return toHeader(config, result.accessToken)
  })

/**
 * The connection's `system.connections` id — the row the startup seeder
 * created, under which the shared token is stored — or the step's refusal.
 */
const findConnectionId = (
  name: string
): Effect.Effect<string | TokenExchangeOutcome, never, ConnectionRepository> =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const outcome = yield* Effect.result(connRepo.findByName(name))
    if (outcome._tag === 'Failure') {
      logError('Connection lookup failed while resolving a token exchange', outcome.failure, {
        'sovrium.connection.name': name,
      })
      return {
        ok: false,
        reason: `connection ${name}: lookup failed (the connection store could not be read)`,
      } as const
    }
    if (outcome.success === undefined) {
      return {
        ok: false,
        reason: `connection ${name}: not found at runtime (was the connection deleted?)`,
      } as const
    }
    return String(outcome.success['id'])
  })

/**
 * The auth header of a `tokenExchange` connection: the stored token while it
 * is valid and was obtained under the current configuration, otherwise a new
 * one from `tokenUrl`. A refused token request fails the step naming the
 * connection, and the API is never called without a token.
 */
export const resolveTokenExchangeHeader = (
  conn: ConnectionDef,
  envLookup: Readonly<Record<string, string>>
): Effect.Effect<
  TokenExchangeOutcome,
  never,
  ConnectionRepository | ConnectionTokenRepository | OAuthTokenClient | SentinelTokens
> =>
  Effect.gen(function* () {
    const connectionId = yield* findConnectionId(conn.name)
    if (typeof connectionId !== 'string') return connectionId
    const config = readConfig(conn, envLookup)
    if (config.request.tokenUrl === '') {
      return { ok: false, reason: `connection ${conn.name}: tokenUrl is empty` } as const
    }
    const tokenRepo = yield* ConnectionTokenRepository
    const stored = yield* tokenRepo.findForApp({ connectionId }).pipe(
      // effect-swallow: an unreadable row is not an outage here — a new token can be obtained without anyone's help, which the branch below does.
      Effect.orElseSucceed(() => undefined)
    )
    const { isSentinelAccessToken } = yield* SentinelTokens
    const valid =
      stored !== undefined &&
      stored.grantFingerprint === fingerprint(config.request) &&
      !isSentinelAccessToken(stored.accessToken) &&
      (stored.expiresAt === undefined || stored.expiresAt.getTime() - Date.now() >= EXPIRY_SKEW_MS)
    if (valid) return toHeader(config, stored.accessToken)
    return yield* OAuthTokenClient.use((tokens) =>
      tokens.withRefreshLock(
        { connectionId, userId: undefined },
        requestAndStore(conn, config, connectionId),
        (cause) => new TokenExchangeTransportError({ cause })
      )
    ).pipe(
      Effect.catchTag('TokenExchangeTransportError', () =>
        Effect.succeed({
          ok: false,
          reason: `connection ${conn.name}: token request failed`,
        } as const)
      )
    )
  }).pipe(Effect.withSpan('automations.resolve-token-exchange-header'))
