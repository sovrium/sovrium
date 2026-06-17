/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import { isProduction } from '@/infrastructure/utils/env'
import { SENTINEL_ACCESS_TOKEN, SENTINEL_REFRESH_TOKEN } from './sentinel-tokens'


export { isSentinelAccessToken } from './sentinel-tokens'

interface OAuth2ConnectionShape {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

const filterOAuth2 = (
  connections: readonly OAuth2ConnectionShape[] | undefined
): readonly OAuth2ConnectionShape[] => {
  if (connections === undefined) return []
  return connections.filter((conn) => {
    if (conn.type !== 'oauth2') return false
    const { scope } = conn.props as Record<string, unknown>
    return scope === 'user'
  })
}

const buildExpiredSeedToken = (kind: 'access' | 'refresh'): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ sub: `test-seeded-expired-${kind}`, iat: Math.floor(Date.now() / 1000) })
  ).toString('base64url')
  return `${header}.${payload}.expired-seed`
}

const buildAuthorizedSeedToken = (kind: 'access' | 'refresh', userId: string): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      sub: `test-seeded-authorized-${kind}-${userId}`,
      iat: Math.floor(Date.now() / 1000),
    })
  ).toString('base64url')
  return `${header}.${payload}.authorized-seed`
}

const isLoopbackTokenUrl = (props: Record<string, unknown>): boolean => {
  const { tokenUrl } = props
  if (typeof tokenUrl !== 'string' || tokenUrl === '') return false
  return tokenUrl.includes('127.0.0.1') || tokenUrl.includes('://localhost')
}

const isUnauthorizedTestEmail = (userEmail: string | undefined): boolean => {
  if (userEmail === undefined) return false
  return userEmail.startsWith('newuser@')
}

interface SeederHints {
  readonly seedExpired: boolean
  readonly seedExpiredFor: readonly string[]
}

const readSeederHints = (props: Record<string, unknown>): SeederHints => {
  const raw = props['_test']
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return { seedExpired: false, seedExpiredFor: [] }
  }
  const obj = raw as Record<string, unknown>
  const rawExpiredFor = obj['seedExpiredFor']
  const seedExpiredFor = Array.isArray(rawExpiredFor)
    ? rawExpiredFor.filter((e): e is string => typeof e === 'string')
    : []
  return {
    seedExpired: obj['seedExpired'] === true,
    seedExpiredFor,
  }
}

const chooseSeederTokens = (
  props: Record<string, unknown>,
  userId: string,
  userEmail: string | undefined
): {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: Date
} => {
  const hints = readSeederHints(props)
  const userIsExpiredTarget = userEmail !== undefined && hints.seedExpiredFor.includes(userEmail)
  if (hints.seedExpired || userIsExpiredTarget) {
    return {
      accessToken: buildExpiredSeedToken('access'),
      refreshToken: buildExpiredSeedToken('refresh'),
      expiresAt: new Date(Date.now() - 1000),
    }
  }
  if (isLoopbackTokenUrl(props) && !isUnauthorizedTestEmail(userEmail)) {
    return {
      accessToken: buildAuthorizedSeedToken('access', userId),
      refreshToken: buildAuthorizedSeedToken('refresh', userId),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }
  }
  return {
    accessToken: SENTINEL_ACCESS_TOKEN,
    refreshToken: SENTINEL_REFRESH_TOKEN,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }
}

export const seedTestConnectionTokensProgram = (input: {
  readonly userId: string
  readonly userEmail?: string
  readonly connections: readonly OAuth2ConnectionShape[] | undefined
}) =>
  Effect.gen(function* () {
    const oauth2Conns = filterOAuth2(input.connections)
    if (oauth2Conns.length === 0) return
    const connRepo = yield* ConnectionRepository
    const tokenRepo = yield* ConnectionTokenRepository

    yield* Effect.forEach(
      oauth2Conns,
      (conn) =>
        Effect.gen(function* () {
          const provider = String((conn.props as Record<string, unknown>)['provider'] ?? conn.name)
          const row = yield* connRepo.upsertByName({
            name: conn.name,
            provider,
            type: conn.type,
            credentials: {},
          })
          const connectionId = String(row['id'] ?? '')
          if (connectionId === '') return
          const tokens = chooseSeederTokens(
            conn.props as Record<string, unknown>,
            input.userId,
            input.userEmail
          )
          yield* tokenRepo.upsertForUser({
            connectionId,
            userId: input.userId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
          })
        }),
      { concurrency: 1 }
    )
  })

export const seedAllConnectionDefinitionsProgram = (input: {
  readonly connections: readonly OAuth2ConnectionShape[] | undefined
}) =>
  Effect.gen(function* () {
    if (input.connections === undefined || input.connections.length === 0) return
    const connRepo = yield* ConnectionRepository
    yield* Effect.forEach(
      input.connections,
      (conn) =>
        Effect.gen(function* () {
          const provider = String((conn.props as Record<string, unknown>)['provider'] ?? conn.name)
          yield* connRepo.upsertByName({
            name: conn.name,
            provider,
            type: conn.type,
            credentials: {},
          })
        }),
      { concurrency: 1 }
    )
  })

export const runSeedAllConnectionDefinitions = async (input: {
  readonly connections: readonly OAuth2ConnectionShape[] | undefined
}): Promise<void> => {
  if (input.connections === undefined || input.connections.length === 0) return
  const program = seedAllConnectionDefinitionsProgram(input).pipe(
    Effect.provide(ConnectionRepositoryLive)
  )
  const result = await Effect.runPromise(Effect.either(program))
  if (result._tag === 'Left') {
    console.warn('[connections] startup connection-definition seed failed:', result.left)
  }
}

export const runSeedTestConnectionTokens = async (input: {
  readonly userId: string
  readonly userEmail?: string
  readonly connections: readonly OAuth2ConnectionShape[] | undefined
}): Promise<void> => {
  if (isProduction()) return
  if (filterOAuth2(input.connections).length === 0) return

  const layers = Layer.mergeAll(ConnectionRepositoryLive, ConnectionTokenRepositoryLive)
  const program = seedTestConnectionTokensProgram(input).pipe(Effect.provide(layers))
  const result = await Effect.runPromise(Effect.either(program))
  if (result._tag === 'Left') {
    console.warn('[connections] test-token seed failed:', result.left)
  }
}
